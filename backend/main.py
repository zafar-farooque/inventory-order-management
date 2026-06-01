from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Product, Customer, Order
from routers import products, customers, orders

import logging
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Lifespan: create tables on startup (gracefully — won't crash if DB is down)
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database tables verified/created.")
    except Exception as e:
        logger.error(f"⚠️  Could not create tables on startup: {e}")
    yield  # app runs here
    # (shutdown logic can go here if needed)

# ─────────────────────────────────────────────────────────────────────────────
# FastAPI app instance
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Inventory & Order Management System",
    description=(
        "A RESTful API for managing products, customers, and orders. "
        "Built with FastAPI and PostgreSQL."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ─────────────────────────────────────────────────────────────────────────────
# CORS Middleware
# Allows all origins so any frontend (React, Vue, mobile, Postman, etc.)
# can call this API during development.
# ⚠️  For production: replace allow_origins=["*"] with a specific domain list,
#    e.g. allow_origins=["https://yourdomain.com"]
# ─────────────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # All origins permitted
    allow_credentials=True,     # Cookies / Authorization headers allowed
    allow_methods=["*"],        # GET, POST, PUT, PATCH, DELETE, OPTIONS
    allow_headers=["*"],        # Any request header accepted
)

# ─────────────────────────────────────────────────────────────────────────────
# Register routers
# ─────────────────────────────────────────────────────────────────────────────
app.include_router(products.router, prefix="/api/v1")
app.include_router(customers.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard response schemas (defined here — no separate file needed)
# ─────────────────────────────────────────────────────────────────────────────

class LowStockProduct(BaseModel):
    """Minimal product snapshot returned by the dashboard for low-stock alerts."""
    id: int
    name: str
    sku: str
    quantity: int

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    """Aggregated system overview returned by GET /api/v1/dashboard."""
    total_products: int
    total_customers: int
    total_orders: int
    low_stock_products: List[LowStockProduct]


# ─────────────────────────────────────────────────────────────────────────────
# Root health-check endpoint
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "message": "Inventory & Order Management API is running.",
        "docs": "/docs",
        "version": "1.0.0",
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard endpoint
# ─────────────────────────────────────────────────────────────────────────────

LOW_STOCK_THRESHOLD = 10  # products with quantity < this value are flagged


@app.get(
    "/api/v1/dashboard",
    response_model=DashboardResponse,
    tags=["Dashboard"],
    summary="System dashboard overview",
    description=(
        "Returns a real-time snapshot of the inventory system:\n\n"
        "- **total_products** — count of all products in the catalogue.\n"
        "- **total_customers** — count of all registered customers.\n"
        "- **total_orders** — count of all orders (any status).\n"
        "- **low_stock_products** — products whose `quantity < 10`, "
        "including their `id`, `name`, `sku`, and current `quantity`."
    ),
)
def dashboard(db: Session = Depends(get_db)):
    """
    Aggregate dashboard statistics in three efficient COUNT queries
    plus one filtered SELECT for low-stock products.
    """
    # Single-row aggregate queries — no Python-side iteration needed
    total_products = db.query(func.count(Product.id)).scalar()
    total_customers = db.query(func.count(Customer.id)).scalar()
    total_orders = db.query(func.count(Order.id)).scalar()

    # Low-stock alert: products with quantity strictly less than the threshold
    low_stock = (
        db.query(Product)
        .filter(Product.quantity < LOW_STOCK_THRESHOLD)
        .order_by(Product.quantity.asc())   # most critical first
        .all()
    )

    return DashboardResponse(
        total_products=total_products or 0,
        total_customers=total_customers or 0,
        total_orders=total_orders or 0,
        low_stock_products=low_stock,
    )
