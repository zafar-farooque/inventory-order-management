from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Product
from schemas import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter(
    prefix="/products",
    tags=["Products"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────

def _get_product_or_404(product_id: int, db: Session) -> Product:
    """Fetch a product by ID, raising HTTP 404 if it does not exist."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found.",
        )
    return product


# ─────────────────────────────────────────────────────────────────────────────
# POST /products  — create a product
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new product",
    description=(
        "Add a new product to the inventory. "
        "The SKU must be unique across all products — returns **400** if it is already taken. "
        "Product quantity must be ≥ 0 (validated by schema)."
    ),
)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    """
    Create a product.

    Raises:
    - **400 Bad Request** – if the SKU already exists in the database.
    - **422 Unprocessable Entity** – if request data fails schema validation
      (e.g. negative quantity, price ≤ 0, empty name).
    """
    # Reject duplicate SKU with 400 (business-rule violation, not a conflict)
    existing = db.query(Product).filter(Product.sku == product.sku).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SKU '{product.sku}' is already in use. Each product must have a unique SKU.",
        )

    db_product = Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


# ─────────────────────────────────────────────────────────────────────────────
# GET /products  — list all products
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=List[ProductResponse],
    summary="List all products",
    description="Return a paginated list of every product in the inventory.",
)
def list_products(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """
    Retrieve all products.

    - **skip**: number of records to skip (offset).
    - **limit**: maximum number of records to return (default 100).
    """
    return db.query(Product).offset(skip).limit(limit).all()


# ─────────────────────────────────────────────────────────────────────────────
# GET /products/{id}  — get one product
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Get a product by ID",
    description="Return a single product. Returns **404** if the product does not exist.",
)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """
    Retrieve a product by its primary key.

    Raises:
    - **404 Not Found** – if no product exists with the given ID.
    """
    return _get_product_or_404(product_id, db)


# ─────────────────────────────────────────────────────────────────────────────
# PUT /products/{id}  — update a product
# ─────────────────────────────────────────────────────────────────────────────

@router.put(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Update a product",
    description=(
        "Update one or more fields of an existing product. "
        "Only the fields provided in the request body are changed (partial update). "
        "Returns **400** if the new SKU is already taken by another product. "
        "Returns **404** if the product does not exist."
    ),
)
def update_product(
    product_id: int,
    updates: ProductUpdate,
    db: Session = Depends(get_db),
):
    """
    Update product fields.

    Raises:
    - **400 Bad Request** – if the new SKU conflicts with an existing product.
    - **404 Not Found** – if no product exists with the given ID.
    - **422 Unprocessable Entity** – if updated values fail schema validation
      (e.g. negative quantity, price ≤ 0).
    """
    product = _get_product_or_404(product_id, db)

    # Only apply fields that were explicitly sent in the request body
    update_data = updates.model_dump(exclude_unset=True)

    # Guard: ensure the new SKU (if changed) is not already taken
    if "sku" in update_data and update_data["sku"] != product.sku:
        conflict = (
            db.query(Product)
            .filter(
                Product.sku == update_data["sku"],
                Product.id != product_id,
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"SKU '{update_data['sku']}' is already in use by another product.",
            )

    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


# ─────────────────────────────────────────────────────────────────────────────
# DELETE /products/{id}  — delete a product
# ─────────────────────────────────────────────────────────────────────────────

@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a product",
    description=(
        "Permanently remove a product from the inventory. "
        "Returns **404** if the product does not exist. "
        "Returns **204 No Content** on success."
    ),
)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """
    Delete a product by ID.

    Raises:
    - **404 Not Found** – if no product exists with the given ID.
    """
    product = _get_product_or_404(product_id, db)
    db.delete(product)
    db.commit()
