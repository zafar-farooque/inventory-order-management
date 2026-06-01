from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Customer
from schemas import CustomerCreate, CustomerResponse

router = APIRouter(
    prefix="/customers",
    tags=["Customers"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────

def _get_customer_or_404(customer_id: int, db: Session) -> Customer:
    """Fetch a customer by ID, raising HTTP 404 if not found."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {customer_id} not found.",
        )
    return customer


# ─────────────────────────────────────────────────────────────────────────────
# POST /customers  — register a new customer
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new customer",
    description=(
        "Create a new customer record. "
        "The **email** must be unique — returns **400** if already registered. "
        "All fields are validated by schema: "
        "`name` (1–255 chars), `email` (valid format), `phone` (optional, max 20 chars)."
    ),
)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    """
    Register a customer.

    Raises:
    - **400 Bad Request** – if a customer with the same email already exists.
    - **422 Unprocessable Entity** – if request data fails schema validation
      (e.g. invalid email format, empty name).
    """
    # Reject duplicate email — return 400, not 409
    existing = db.query(Customer).filter(Customer.email == customer.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Email '{customer.email}' is already registered. "
                "Each customer must have a unique email address."
            ),
        )

    db_customer = Customer(**customer.model_dump())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer


# ─────────────────────────────────────────────────────────────────────────────
# GET /customers  — list all customers
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=List[CustomerResponse],
    summary="List all customers",
    description="Return a paginated list of all registered customers.",
)
def list_customers(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """
    Retrieve all customers.

    - **skip**: number of records to skip (offset).
    - **limit**: maximum number of records to return (default 100).
    """
    return db.query(Customer).offset(skip).limit(limit).all()


# ─────────────────────────────────────────────────────────────────────────────
# GET /customers/{id}  — get one customer
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Get a customer by ID",
    description="Return a single customer by their ID. Returns **404** if not found.",
)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    """
    Retrieve a customer by their primary key.

    Raises:
    - **404 Not Found** – if no customer exists with the given ID.
    """
    return _get_customer_or_404(customer_id, db)


# ─────────────────────────────────────────────────────────────────────────────
# DELETE /customers/{id}  — delete a customer
# ─────────────────────────────────────────────────────────────────────────────

@router.delete(
    "/{customer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a customer",
    description=(
        "Permanently remove a customer record. "
        "Returns **204 No Content** on success. "
        "Returns **404** if the customer does not exist."
    ),
)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    """
    Delete a customer by ID.

    Raises:
    - **404 Not Found** – if no customer exists with the given ID.
    """
    customer = _get_customer_or_404(customer_id, db)
    db.delete(customer)
    db.commit()
