"""
Configuration management for MCI Scraper service.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Security
    api_key: str = "change-me-in-production"

    # 2Captcha
    two_captcha_api_key: str = ""

    # Browser Pool
    browser_pool_size: int = 3
    browser_headless: bool = True

    # Scraping
    page_timeout_seconds: int = 60
    captcha_timeout_seconds: int = 120

    # Logging
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
