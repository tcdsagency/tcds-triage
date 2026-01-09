"""
Payment check endpoints for MCI Scraper.
"""

from fastapi import APIRouter, HTTPException
import structlog

from app.models.request import PaymentCheckRequest
from app.models.response import PaymentCheckResponse
from app.services.scraper import mci_scraper

logger = structlog.get_logger()

router = APIRouter()


@router.post("", response_model=PaymentCheckResponse)
@router.post("/", response_model=PaymentCheckResponse)
async def check_payment(request: PaymentCheckRequest):
    """
    Check payment status for a mortgage on MyCoverageInfo.

    This endpoint scrapes MyCoverageInfo.com to retrieve the current
    payment status for the specified policy.

    Args:
        request: Payment check request with loan_number, zip_code, and optional last_name

    Returns:
        Payment status and policy information
    """
    logger.info(
        "Payment check requested",
        loan_number=request.loan_number[:4] + "****",
        zip_code=request.zip_code,
    )

    try:
        result = await mci_scraper.check_payment(
            loan_number=request.loan_number,
            zip_code=request.zip_code,
            last_name=request.last_name,
        )

        # Convert MCIResult to PaymentCheckResponse
        response = PaymentCheckResponse(
            success=result.success,
            payment_status=_map_payment_status(result.payment_status),
            paid_through_date=None,  # MCI doesn't always provide this directly
            next_due_date=None,
            amount_due=None,
            premium_amount=result.premium,
            policy_number=result.policy_number,
            carrier=result.insurance_company,
            effective_date=_parse_date(result.effective_date),
            expiration_date=_parse_date(result.expiration_date),
            cancellation_date=None,
            cancellation_reason=None,
            screenshot_base64=result.screenshot_base64,
            error_code=result.error_code,
            error_message=result.error_message,
            duration_ms=result.duration_ms,
        )

        # If we have last payment info, that's our "paid through" indication
        if result.last_payment_date:
            response.paid_through_date = _parse_date(result.last_payment_date)

        if result.last_payment_amount:
            response.amount_due = 0.0 if result.payment_status == "Paid" else None

        return response

    except Exception as e:
        logger.error("Payment check failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Payment check failed: {str(e)}"
        )


def _map_payment_status(status: str | None) -> str | None:
    """Map MCI payment status to our standard enum values."""
    if not status:
        return None

    status_lower = status.lower()

    if status_lower == "paid":
        return "current"
    elif status_lower in ("unpaid", "past due"):
        return "late"
    elif status_lower == "pending":
        return "grace_period"
    elif "cancelled" in status_lower or "lapsed" in status_lower:
        return "lapsed"

    return "unknown"


def _parse_date(date_str: str | None):
    """Parse MM/DD/YYYY date string to date object."""
    if not date_str:
        return None

    try:
        from datetime import datetime
        return datetime.strptime(date_str, "%m/%d/%Y").date()
    except ValueError:
        return None
