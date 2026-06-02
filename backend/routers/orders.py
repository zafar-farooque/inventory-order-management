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

router = APIRouter(prefix="/orders", tags=["Orders"])


def _get_order_or_404(order_id: int, db: Session) -> Order:
    order = (
        db.query(Order)
        .options(joinedload(Order.order_items), joinedload(Order.customer))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found.")
    return order


def _build_detail_response(order: Order, db: Session) -> OrderDetailResponse:
    product_ids = [item.product_id for item in order.order_items]
    products = db.query(Product).filter(Product.id.in_(product_ids)).all()
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

    customer_info = CustomerInfo.model_validate(order.customer) if order.customer else None

    return OrderDetailResponse(
        id=order.id,
        customer_id=order.customer_id,
        customer=customer_info,
        status=order.status,
        total_amount=order.total_amount,
        created_at=order.created_at,
        order_items=enriched_items,
    )


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer {order.customer_id} not found.")

    products_map: dict[int, Product] = {}
    for item in order.items:
        if item.product_id in products_map:
            continue
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found.")
        if product.quantity < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{product.name}'. Requested: {item.quantity}, Available: {product.quantity}.",
            )
        products_map[item.product_id] = product

    total_amount = round(
        sum(item.quantity * products_map[item.product_id].price for item in order.items), 2
    )

    db_order = Order(customer_id=order.customer_id, status=order.status, total_amount=total_amount)
    db.add(db_order)
    db.flush()

    for item in order.items:
        product = products_map[item.product_id]
        db.add(OrderItem(
            order_id=db_order.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=product.price,
        ))
        product.quantity -= item.quantity

    db.commit()
    return _get_order_or_404(db_order.id, db)


@router.get("", response_model=List[OrderResponse])
def list_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return (
        db.query(Order)
        .options(joinedload(Order.order_items), joinedload(Order.customer))
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{order_id}", response_model=OrderDetailResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = _get_order_or_404(order_id, db)
    return _build_detail_response(order, db)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = _get_order_or_404(order_id, db)
    for item in order.order_items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            product.quantity += item.quantity
    db.delete(order)
    db.commit()
