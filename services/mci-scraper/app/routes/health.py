"""
Health check endpoints for MCI Scraper.
"""

from fastapi import APIRouter
import structlog

from app.models.response import HealthResponse
from app.services.browser import browser_pool
from app.services.captcha import captcha_solver

logger = structlog.get_logger()

router = APIRouter()


@router.get("", response_model=HealthResponse)
@router.get("/", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint.

    Returns service status and resource availability.
    """
    # Determine overall status
    status = "healthy"

    if browser_pool.available_count == 0:
        status = "degraded"

    if browser_pool.total_count == 0:
        status = "unhealthy"

    # Get 2Captcha balance (cached or fresh)
    balance = captcha_solver.cached_balance
    if balance is None:
        try:
            balance = await captcha_solver.get_balance()
        except Exception:
            pass

    # If balance is very low, mark as degraded
    if balance is not None and balance < 0.10:
        status = "degraded"

    return HealthResponse(
        status=status,
        browser_pool_available=browser_pool.available_count,
        browser_pool_total=browser_pool.total_count,
        two_captcha_balance=balance,
    )


@router.get("/ready")
async def readiness_check():
    """
    Readiness check for Kubernetes/container orchestration.

    Returns 200 if service is ready to accept requests.
    """
    if browser_pool.total_count == 0:
        return {"ready": False, "reason": "No browser instances available"}

    return {"ready": True}


@router.get("/live")
async def liveness_check():
    """
    Liveness check for Kubernetes/container orchestration.

    Returns 200 if service is alive.
    """
    return {"alive": True}
