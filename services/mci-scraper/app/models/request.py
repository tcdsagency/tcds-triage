"""
Request models for MCI Scraper API.
"""

from pydantic import BaseModel, Field
from typing import Optional


class PaymentCheckRequest(BaseModel):
    """Request model for payment status check."""

    policy_number: str = Field(
        ...,
        description="Insurance policy number to look up",
        min_length=1,
        max_length=50,
    )
    zip_code: str = Field(
        ...,
        description="Property ZIP code",
        min_length=5,
        max_length=10,
    )
    loan_number: Optional[str] = Field(
        None,
        description="Mortgage loan number (optional, for additional lookup)",
        max_length=50,
    )
    last_name: Optional[str] = Field(
        None,
        description="Insured's last name (optional, may help with lookup)",
        max_length=100,
    )
