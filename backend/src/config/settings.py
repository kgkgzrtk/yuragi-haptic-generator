"""
Application configuration settings
"""

import logging
from functools import lru_cache
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support"""

    # App Configuration
    app_name: str = Field(default="Yuragi Haptic Generator API", env="APP_NAME")
    app_version: str = Field(default="0.1.0", env="APP_VERSION")
    app_description: str = Field(
        default="Sawtooth wave-based haptic feedback system API", env="APP_DESCRIPTION"
    )
    debug: bool = Field(default=False, env="DEBUG")

    # Server Configuration
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8000, env="PORT")
    reload: bool = Field(default=False, env="RELOAD")
    workers: int = Field(default=1, env="WORKERS")

    # CORS Configuration
    cors_origins: list[str] = Field(
        default=["http://localhost:3000"], env="CORS_ORIGINS"
    )
    cors_allow_credentials: bool = Field(default=True, env="CORS_ALLOW_CREDENTIALS")
    cors_allow_methods: list[str] = Field(
        default=["GET", "POST", "PUT", "DELETE", "OPTIONS"], env="CORS_ALLOW_METHODS"
    )
    cors_allow_headers: list[str] = Field(default=["*"], env="CORS_ALLOW_HEADERS")

    # Haptic System Configuration
    sample_rate: int = Field(default=44100, env="HAPTIC_SAMPLE_RATE")
    block_size: int = Field(default=512, env="HAPTIC_BLOCK_SIZE")
    max_frequency: float = Field(default=120.0, env="HAPTIC_MAX_FREQUENCY")
    min_frequency: float = Field(default=0.0, env="HAPTIC_MIN_FREQUENCY")

    # WebSocket Configuration
    websocket_ping_interval: int = Field(default=20, env="WS_PING_INTERVAL")
    websocket_ping_timeout: int = Field(default=60, env="WS_PING_TIMEOUT")
    websocket_max_connections: int = Field(default=100, env="WS_MAX_CONNECTIONS")

    # Logging Configuration
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_format: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s", env="LOG_FORMAT"
    )
    enable_access_log: bool = Field(default=True, env="ENABLE_ACCESS_LOG")
    log_file: Optional[str] = Field(default=None, env="LOG_FILE")

    # Performance Configuration
    request_timeout: int = Field(default=30, env="REQUEST_TIMEOUT")
    keep_alive_timeout: int = Field(default=5, env="KEEP_ALIVE_TIMEOUT")
    max_request_size: int = Field(default=16777216, env="MAX_REQUEST_SIZE")  # 16MB

    # Security Configuration
    api_key: Optional[str] = Field(default=None, env="API_KEY")
    allowed_hosts: list[str] = Field(default=["*"], env="ALLOWED_HOSTS")
    trust_host_header: bool = Field(default=False, env="TRUST_HOST_HEADER")

    # Environment
    environment: str = Field(default="development", env="ENVIRONMENT")

    @field_validator("cors_origins", mode="before")
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [item.strip() for item in v.split(",")]
        return v

    @field_validator("cors_allow_methods", mode="before")
    def parse_cors_methods(cls, v):
        if isinstance(v, str):
            return [item.strip() for item in v.split(",")]
        return v

    @field_validator("cors_allow_headers", mode="before")
    def parse_cors_headers(cls, v):
        if isinstance(v, str):
            return [item.strip() for item in v.split(",")]
        return v

    @field_validator("allowed_hosts", mode="before")
    def parse_allowed_hosts(cls, v):
        if isinstance(v, str):
            return [item.strip() for item in v.split(",")]
        return v

    @field_validator("log_level")
    def validate_log_level(cls, v):
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Invalid log level. Must be one of: {valid_levels}")
        return v.upper()

    @field_validator("workers")
    def validate_workers(cls, v):
        if v < 1:
            raise ValueError("Workers must be at least 1")
        return v

    @field_validator("port")
    def validate_port(cls, v):
        if not (1 <= v <= 65535):
            raise ValueError("Port must be between 1 and 65535")
        return v

    @property
    def is_production(self) -> bool:
        """Check if we're in production environment"""
        return self.environment.lower() == "production"

    @property
    def is_development(self) -> bool:
        """Check if we're in development environment"""
        return self.environment.lower() == "development"

    @property
    def uvicorn_config(self) -> dict:
        """Get uvicorn configuration"""
        config = {
            "host": self.host,
            "port": self.port,
            "reload": self.reload and not self.is_production,
            "log_level": self.log_level.lower(),
            "access_log": self.enable_access_log,
            "server_header": False,  # Security: don't expose server info
            "date_header": False,  # Security: don't expose date
        }

        if self.is_production:
            config.update(
                {
                    "workers": self.workers,
                    "timeout_keep_alive": self.keep_alive_timeout,
                    "limit_max_requests": 1000,  # Restart workers after N requests
                    "limit_concurrency": 1000,  # Max concurrent connections
                }
            )

        return config

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


def setup_logging(settings: Settings) -> None:
    """Setup application logging with production-ready configuration"""
    from .logging import setup_production_logging

    # Use advanced logging configuration for production
    if settings.is_production:
        setup_production_logging(
            app_name=settings.app_name,
            log_level=settings.log_level,
            log_file=settings.log_file,
            enable_json=True,
            enable_health_filter=True,
        )
    else:
        # Simpler configuration for development
        logging.basicConfig(
            level=getattr(logging, settings.log_level),
            format=settings.log_format,
            filename=settings.log_file,
        )

    # Log configuration
    logger = logging.getLogger(__name__)
    logger.info(
        "Application starting",
        extra={
            "environment": settings.environment,
            "log_level": settings.log_level,
            "cors_origins": settings.cors_origins,
            "debug": settings.debug,
        },
    )

    if settings.debug:
        logger.debug("Debug mode enabled")
        logger.debug("Settings loaded", extra={"settings": settings.model_dump()})
