from contextlib import asynccontextmanager
from typing import List, Optional
import logging

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Product, Customer, Order
from routers import products, customers, orders

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables ready.")
    except Exception as e:
        logger.error(f"Could not create tables on startup: {e}")
    yield


app = FastAPI(
    title="Inventory & Order Management System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router, prefix="/api/v1")
app.include_router(customers.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")


class LowStockProduct(BaseModel):
    id: int
    name: str
    sku: str
    quantity: int

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    total_products: int
    total_customers: int
    total_orders: int
    low_stock_products: List[LowStockProduct]


@app.get("/", tags=["Health"])
def root():
    return {"message": "Inventory & Order Management API is running.", "docs": "/docs", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}


LOW_STOCK_THRESHOLD = 10


@app.get("/api/v1/dashboard", response_model=DashboardResponse, tags=["Dashboard"])
def dashboard(db: Session = Depends(get_db)):
    total_products = db.query(func.count(Product.id)).scalar()
    total_customers = db.query(func.count(Customer.id)).scalar()
    total_orders = db.query(func.count(Order.id)).scalar()

    low_stock = (
        db.query(Product)
        .filter(Product.quantity < LOW_STOCK_THRESHOLD)
        .order_by(Product.quantity.asc())
        .all()
    )

    return DashboardResponse(
        total_products=total_products or 0,
        total_customers=total_customers or 0,
        total_orders=total_orders or 0,
        low_stock_products=low_stock,
    )
