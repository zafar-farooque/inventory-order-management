from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Order, OrderItem, Customer, Product
from schemas import (
    OrderCreate,
    OrderResponse,
    OrderDetailResponse,
    OrderItemDetailResponse,
    CustomerInfo,
)

router = APIRouter(
    prefix="/orders",
    tags=["Orders"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_order_or_404(order_id: int, db: Session) -> Order:
    """Fetch an order (with items + customer) by ID, raising 404 if missing."""
    order = (
        db.query(Order)
        .options(
            joinedload(Order.order_items),
            joinedload(Order.customer),
        )
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {order_id} not found.",
        )
    return order


def _build_detail_response(order: Order, db: Session) -> OrderDetailResponse:
    """
    Build an OrderDetailResponse by enriching each OrderItem with its
    product name and computing the line_total field.
    """
    # Collect all product IDs for a single batch query
    product_ids = [item.product_id for item in order.order_items]
    products = (
        db.query(Product)
        .filter(Product.id.in_(product_ids))
        .all()
    )
    product_map = {p.id: p for p in products}

    enriched_items = []
    for item in order.order_items:
        product = product_map.get(item.product_id)
        enriched_items.append(
            OrderItemDetailResponse(
                id=item.id,
                order_id=item.order_id,
                product_id=item.product_id,
                product_name=product.name if product else f"[Deleted product #{item.product_id}]",
                quantity=item.quantity,
                unit_price=item.unit_price,
                line_total=round(item.quantity * item.unit_price, 2),
            )
        )

    customer_info = (
        CustomerInfo.model_validate(order.customer) if order.customer else None
    )

    return OrderDetailResponse(
        id=order.id,
        customer_id=order.customer_id,
        customer=customer_info,
        status=order.status,
        total_amount=order.total_amount,
        created_at=order.created_at,
        order_items=enriched_items,
    )


# ─────────────────────────────────────────────────────────────────────────────
# POST /orders  — place a new order
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Place a new order",
    description=(
        "Create an order for a customer with one or more products. "
        "**Business rules enforced:**\n\n"
        "1. Customer must exist.\n"
        "2. Every product must exist.\n"
        "3. Each product must have sufficient stock — returns **400** if not.\n"
        "4. `total_amount` is calculated automatically: `Σ (quantity × product.price)`.\n"
        "5. Stock is deducted from each product atomically in one transaction.\n\n"
        "The client does **not** supply `unit_price` — it is taken from the product's current price."
    ),
)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    """
    Place an order.

    Raises:
    - **404 Not Found** – customer or any product does not exist.
    - **400 Bad Request** – any product has insufficient stock.
    - **422 Unprocessable Entity** – schema validation fails (e.g. quantity < 1).
    """
    # ── Step 1: Validate customer ──────────────────────────────────────────
    customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {order.customer_id} not found.",
        )

    # ── Step 2: Validate all products & stock BEFORE any writes ───────────
    # Using SELECT ... FOR UPDATE would be ideal in high-concurrency systems;
    # for this application a pre-flight check is sufficient.
    products_map: dict[int, Product] = {}
    for item in order.items:
        if item.product_id in products_map:
            continue  # already validated this product in a previous item

        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {item.product_id} not found.",
            )
        if product.quantity < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient stock for '{product.name}' (SKU: {product.sku}). "
                    f"Requested: {item.quantity}, Available: {product.quantity}."
                ),
            )
        products_map[item.product_id] = product

    # ── Step 3: Calculate total_amount from the product's current price ────
    total_amount = round(
        sum(item.quantity * products_map[item.product_id].price for item in order.items),
        2,
    )

    # ── Step 4: Create the Order record ────────────────────────────────────
    db_order = Order(
        customer_id=order.customer_id,
        status=order.status,
        total_amount=total_amount,
    )
    db.add(db_order)
    db.flush()  # obtain db_order.id without committing yet

    # ── Step 5: Create OrderItems and deduct stock (single transaction) ────
    for item in order.items:
        product = products_map[item.product_id]
        db.add(
            OrderItem(
                order_id=db_order.id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=product.price,  # snapshot price at time of order
            )
        )
        product.quantity -= item.quantity  # deduct stock

    db.commit()

    # Reload with relationships for the response
    return _get_order_or_404(db_order.id, db)


# ─────────────────────────────────────────────────────────────────────────────
# GET /orders  — list all orders with customer info and items
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=List[OrderResponse],
    summary="List all orders",
    description=(
        "Return a paginated list of all orders. "
        "Each order includes the customer info and its line items."
    ),
)
def list_orders(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """
    Retrieve all orders.

    - **skip**: offset for pagination.
    - **limit**: maximum records to return (default 100).
    """
    return (
        db.query(Order)
        .options(
            joinedload(Order.order_items),
            joinedload(Order.customer),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /orders/{id}  — full order detail with items and product names
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/{order_id}",
    response_model=OrderDetailResponse,
    summary="Get full order detail",
    description=(
        "Return a single order with complete detail:\n\n"
        "- Full **customer info** (name, email, phone).\n"
        "- Each line item enriched with the **product name** and **line total**.\n\n"
        "Returns **404** if the order does not exist."
    ),
)
def get_order(order_id: int, db: Session = Depends(get_db)):
    """
    Retrieve an order by its primary key with full enrichment.

    Raises:
    - **404 Not Found** – if no order exists with the given ID.
    """
    order = _get_order_or_404(order_id, db)
    return _build_detail_response(order, db)


# ─────────────────────────────────────────────────────────────────────────────
# DELETE /orders/{id}  — cancel order and RESTORE stock
# ─────────────────────────────────────────────────────────────────────────────

@router.delete(
    "/{order_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel and delete an order",
    description=(
        "Delete an order and all its line items. "
        "**Stock is automatically restored** for every product in the order. "
        "Returns **204 No Content** on success. "
        "Returns **404** if the order does not exist."
    ),
)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    """
    Cancel an order and restore inventory.

    Raises:
    - **404 Not Found** – if no order exists with the given ID.

    Stock restoration:
    Each product referenced by an OrderItem has its quantity incremented
    by the ordered amount before the order (and items) are deleted.
    """
    order = _get_order_or_404(order_id, db)

    # ── Restore stock for every line item ─────────────────────────────────
    for item in order.order_items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            product.quantity += item.quantity  # give the stock back

    # Cascade delete removes OrderItems automatically (defined in models.py)
    db.delete(order)
    db.commit()
