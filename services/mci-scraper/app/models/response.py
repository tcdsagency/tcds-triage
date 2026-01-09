"""
Response models for MCI Scraper API.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


class PaymentCheckResponse(BaseModel):
    """Response model for payment status check."""

    success: bool = Field(..., description="Whether the check completed successfully")

    # Payment status
    payment_status: Optional[str] = Field(
        None,
        description="Payment status: current, late, grace_period, lapsed, unknown",
    )
    paid_through_date: Optional[date] = Field(
        None,
        description="Date through which payments are current",
    )
    next_due_date: Optional[date] = Field(
        None,
        description="Next payment due date",
    )
    amount_due: Optional[float] = Field(
        None,
        description="Amount currently due",
    )
    premium_amount: Optional[float] = Field(
        None,
        description="Total premium amount",
    )

    # Policy info from MCI
    policy_number: Optional[str] = Field(
        None,
        description="Policy number as shown on MCI",
    )
    carrier: Optional[str] = Field(
        None,
        description="Insurance carrier name",
    )
    effective_date: Optional[date] = Field(
        None,
        description="Policy effective date",
    )
    expiration_date: Optional[date] = Field(
        None,
        description="Policy expiration date",
    )
    cancellation_date: Optional[date] = Field(
        None,
        description="Policy cancellation date if cancelled",
    )
    cancellation_reason: Optional[str] = Field(
        None,
        description="Reason for cancellation if applicable",
    )

    # Audit trail
    screenshot_base64: Optional[str] = Field(
        None,
        description="Base64 encoded screenshot of result page",
    )

    # Error info
    error_code: Optional[str] = Field(
        None,
        description="Error code if check failed",
    )
    error_message: Optional[str] = Field(
        None,
        description="Error message if check failed",
    )

    # Performance
    duration_ms: int = Field(
        0,
        description="Time taken to complete check in milliseconds",
    )


class HealthResponse(BaseModel):
    """Response model for health check."""

    status: str = Field(..., description="Service status: healthy, degraded, unhealthy")
    browser_pool_available: int = Field(
        ...,
        description="Number of available browser instances"
    )
    browser_pool_total: int = Field(
        ...,
        description="Total browser pool size"
    )
    two_captcha_balance: Optional[float] = Field(
        None,
        description="2Captcha account balance if available"
    )
    version: str = Field("1.0.0", description="Service version")
