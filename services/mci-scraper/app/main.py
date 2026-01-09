"""
MyCoverageInfo Payment Checker Microservice
============================================
Scrapes MyCoverageInfo.com to verify mortgagee payment status.
Uses undetected-chromedriver to avoid bot detection.
"""

from fastapi import FastAPI, HTTPException, Depends, Header
from contextlib import asynccontextmanager
import structlog

from app.config import settings
from app.routes import health, check
from app.services.browser import browser_pool

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage browser pool lifecycle."""
    logger.info(
        "Starting MCI Scraper service",
        pool_size=settings.browser_pool_size,
        headless=settings.browser_headless,
    )
    await browser_pool.initialize()
    yield
    logger.info("Shutting down MCI Scraper service")
    await browser_pool.cleanup()


app = FastAPI(
    title="MyCoverageInfo Payment Checker",
    description="Scrapes MyCoverageInfo.com to verify mortgagee payment status",
    version="1.0.0",
    lifespan=lifespan,
)


async def verify_api_key(x_api_key: str = Header(..., alias="X-API-Key")):
    """Verify API key for protected routes."""
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key


# Include routers
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(
    check.router,
    prefix="/api/v1/check",
    tags=["Payment Checks"],
    dependencies=[Depends(verify_api_key)],
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "MyCoverageInfo Payment Checker",
        "version": "1.0.0",
        "docs": "/docs",
    }
