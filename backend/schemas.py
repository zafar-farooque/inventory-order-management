from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator


# ─────────────────────────────────────────────
# Product Schemas
# ─────────────────────────────────────────────

class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Product name")
    sku: str = Field(..., min_length=1, max_length=100, description="Unique stock-keeping unit identifier")
    price: float = Field(..., gt=0, description="Price must be greater than zero")
    quantity: int = Field(..., ge=0, description="Stock quantity — must be 0 or greater")

    @field_validator("quantity")
    @classmethod
    def quantity_must_not_be_negative(cls, v: int) -> int:
        """Reject negative stock quantities at the schema level."""
        if v < 0:
            raise ValueError(
                f"Product quantity cannot be negative. Received: {v}. "
                "Use 0 to mark a product as out of stock."
            )
        return v


class ProductCreate(ProductBase):
    """Schema for creating a new product."""
    pass


class ProductUpdate(BaseModel):
    """Schema for partially updating a product (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    sku: Optional[str] = Field(None, min_length=1, max_length=100)
    price: Optional[float] = Field(None, gt=0)
    quantity: Optional[int] = Field(None, ge=0)

    @field_validator("quantity")
    @classmethod
    def quantity_must_not_be_negative(cls, v: Optional[int]) -> Optional[int]:
        """Reject negative stock quantities on update."""
        if v is not None and v < 0:
            raise ValueError(
                f"Product quantity cannot be negative. Received: {v}. "
                "Use 0 to mark a product as out of stock."
            )
        return v


class ProductResponse(ProductBase):
    """Schema for reading/returning product data."""
    id: int
    created_at: datetime

    class Config:
        from_attributes = True  # Allows reading from ORM model instances


# ─────────────────────────────────────────────
# Customer Schemas
# ─────────────────────────────────────────────

class CustomerBase(BaseModel):
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Customer full name (1–255 characters)",
    )
    email: EmailStr = Field(
        ...,
        description="Unique, valid customer email address",
    )
    phone: Optional[str] = Field(
        None,
        max_length=20,
        description="Customer phone number (optional, max 20 chars)",
    )

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        """Strip surrounding whitespace and reject names that are blank after stripping."""
        stripped = v.strip()
        if not stripped:
            raise ValueError(
                "Customer name cannot be blank or contain only whitespace."
            )
        return stripped

    @field_validator("phone")
    @classmethod
    def phone_format(cls, v: Optional[str]) -> Optional[str]:
        """
        Validate phone format when provided.
        Allows digits, spaces, hyphens, parentheses, and a leading '+'.
        Example valid values: '+1-800-555-0100', '(044) 123 4567', '+447911123456'.
        """
        import re
        if v is None:
            return v
        stripped = v.strip()
        if not stripped:
            raise ValueError("Phone number cannot be an empty string. Omit the field if not applicable.")
        if not re.fullmatch(r"[\d\s\+\-\(\)]{3,20}", stripped):
            raise ValueError(
                f"Invalid phone number format: '{stripped}'. "
                "Allowed characters: digits, spaces, '+', '-', '(', ')'. "
                "Length must be between 3 and 20 characters."
            )
        return stripped


class CustomerCreate(CustomerBase):
    """Schema for creating a new customer."""
    pass


class CustomerResponse(CustomerBase):
    """Schema for reading/returning customer data."""
    id: int
    created_at: datetime

    class Config:
        from_attributes = True



# ─────────────────────────────────────────────
# OrderItem Schemas
# ─────────────────────────────────────────────

class OrderItemCreate(BaseModel):
    """
    Input schema for a single line item when placing an order.
    The client supplies only product_id and quantity.
    unit_price is derived automatically from the product's current price.
    """
    product_id: int = Field(..., gt=0, description="ID of the product being ordered")
    quantity: int = Field(..., gt=0, description="Quantity to order — must be at least 1")


class OrderItemResponse(BaseModel):
    """Basic order item response (includes unit_price stored at time of order)."""
    id: int
    order_id: int
    product_id: int
    quantity: int
    unit_price: float

    class Config:
        from_attributes = True


class OrderItemDetailResponse(BaseModel):
    """
    Enriched order item response — includes the product name
    for human-readable order detail views.
    """
    id: int
    order_id: int
    product_id: int
    product_name: str          # populated by the router, not stored in DB
    quantity: int
    unit_price: float
    line_total: float          # quantity × unit_price, computed in router

    class Config:
        from_attributes = False  # built manually, not from ORM


# ─────────────────────────────────────────────
# Order Schemas
# ─────────────────────────────────────────────

VALID_STATUSES = {"pending", "confirmed", "shipped", "delivered", "cancelled"}


class OrderBase(BaseModel):
    customer_id: int = Field(..., description="ID of the customer placing the order")
    status: str = Field(default="pending", description="Order status")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"Invalid status '{v}'. Must be one of: {VALID_STATUSES}")
        return v


class OrderCreate(OrderBase):
    """Schema for creating a new order with its line items."""
    items: List[OrderItemCreate] = Field(
        ...,
        min_length=1,
        description="At least one line item is required",
    )


class OrderUpdate(BaseModel):
    """Schema for updating order status."""
    status: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"Invalid status '{v}'. Must be one of: {VALID_STATUSES}")
        return v


# ─────────────────────────────────────────────
# Customer snapshot embedded inside order responses
# ─────────────────────────────────────────────

class CustomerInfo(BaseModel):
    """Lightweight customer snapshot embedded in order list/detail responses."""
    id: int
    name: str
    email: str
    phone: Optional[str] = None

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Order response schemas
# ─────────────────────────────────────────────

class OrderResponse(BaseModel):
    """
    Order response for list endpoints.
    Includes customer info and basic line items.
    """
    id: int
    customer_id: int
    customer: Optional[CustomerInfo] = None
    status: str
    total_amount: float
    created_at: datetime
    order_items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True


class OrderDetailResponse(BaseModel):
    """
    Enriched order response for the GET /orders/{id} endpoint.
    Includes full customer info and enriched items with product names.
    """
    id: int
    customer_id: int
    customer: Optional[CustomerInfo] = None
    status: str
    total_amount: float
    created_at: datetime
    order_items: List[OrderItemDetailResponse] = []

    class Config:
        from_attributes = False  # built manually from ORM + enrichment
