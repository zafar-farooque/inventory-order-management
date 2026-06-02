from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    sku: str = Field(..., min_length=1, max_length=100)
    price: float = Field(..., gt=0)
    quantity: int = Field(..., ge=0)

    @field_validator("quantity")
    @classmethod
    def quantity_must_not_be_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Product quantity cannot be negative.")
        return v


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    sku: Optional[str] = Field(None, min_length=1, max_length=100)
    price: Optional[float] = Field(None, gt=0)
    quantity: Optional[int] = Field(None, ge=0)

    @field_validator("quantity")
    @classmethod
    def quantity_must_not_be_negative(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("Product quantity cannot be negative.")
        return v


class ProductResponse(ProductBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Customer name cannot be blank.")
        return stripped

    @field_validator("phone")
    @classmethod
    def phone_format(cls, v: Optional[str]) -> Optional[str]:
        import re
        if v is None:
            return v
        stripped = v.strip()
        if not stripped:
            raise ValueError("Phone number cannot be an empty string.")
        if not re.fullmatch(r"[\d\s\+\-\(\)]{3,20}", stripped):
            raise ValueError("Invalid phone number format.")
        return stripped


class CustomerCreate(CustomerBase):
    pass


class CustomerResponse(CustomerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class OrderItemCreate(BaseModel):
    product_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0)


class OrderItemResponse(BaseModel):
    id: int
    order_id: int
    product_id: int
    quantity: int
    unit_price: float

    class Config:
        from_attributes = True


class OrderItemDetailResponse(BaseModel):
    id: int
    order_id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: float
    line_total: float

    class Config:
        from_attributes = False


VALID_STATUSES = {"pending", "confirmed", "shipped", "delivered", "cancelled"}


class OrderBase(BaseModel):
    customer_id: int
    status: str = Field(default="pending")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"Invalid status '{v}'. Must be one of: {VALID_STATUSES}")
        return v


class OrderCreate(OrderBase):
    items: List[OrderItemCreate] = Field(..., min_length=1)


class OrderUpdate(BaseModel):
    status: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"Invalid status '{v}'. Must be one of: {VALID_STATUSES}")
        return v


class CustomerInfo(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str] = None

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
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
    id: int
    customer_id: int
    customer: Optional[CustomerInfo] = None
    status: str
    total_amount: float
    created_at: datetime
    order_items: List[OrderItemDetailResponse] = []

    class Config:
        from_attributes = False
