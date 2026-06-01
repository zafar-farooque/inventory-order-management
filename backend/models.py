from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from database import Base


class Product(Base):
    """
    Represents a product in the inventory.
    """
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    sku = Column(String(100), unique=True, nullable=False, index=True)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Back-reference to order items that include this product
    order_items = relationship("OrderItem", back_populates="product")

    def __repr__(self):
        return f"<Product(id={self.id}, name='{self.name}', sku='{self.sku}')>"


class Customer(Base):
    """
    Represents a customer who can place orders.
    """
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # A customer can have many orders
    orders = relationship("Order", back_populates="customer")

    def __repr__(self):
        return f"<Customer(id={self.id}, name='{self.name}', email='{self.email}')>"


class Order(Base):
    """
    Represents a customer order. An order belongs to one customer
    and contains one or more order items.
    """
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    total_amount = Column(Float, nullable=False, default=0.0)
    status = Column(String(50), nullable=False, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="orders")
    order_items = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Order(id={self.id}, customer_id={self.customer_id}, status='{self.status}')>"


class OrderItem(Base):
    """
    Represents a single line item within an order,
    linking a product with its quantity and price at the time of purchase.
    """
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)

    # Relationships
    order = relationship("Order", back_populates="order_items")
    product = relationship("Product", back_populates="order_items")

    def __repr__(self):
        return (
            f"<OrderItem(id={self.id}, order_id={self.order_id}, "
            f"product_id={self.product_id}, quantity={self.quantity})>"
        )
