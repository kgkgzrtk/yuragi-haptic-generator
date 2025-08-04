"""
Advanced logging configuration for production
Provides structured logging with JSON formatting and multiple handlers
"""

import json
import logging
import logging.config
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional


class JSONFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging"""

    def format(self, record: logging.LogRecord) -> str:
        # Create log entry dictionary
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add process and thread info
        log_entry["process"] = {
            "pid": os.getpid(),
            "name": record.processName,
        }
        log_entry["thread"] = {
            "id": record.thread,
            "name": record.threadName,
        }

        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": self.formatException(record.exc_info),
            }

        # Add extra fields
        extra_fields = {}
        for key, value in record.__dict__.items():
            if key not in {
                "name",
                "msg",
                "args",
                "levelname",
                "levelno",
                "pathname",
                "filename",
                "module",
                "lineno",
                "funcName",
                "created",
                "msecs",
                "relativeCreated",
                "thread",
                "threadName",
                "processName",
                "process",
                "exc_info",
                "exc_text",
                "stack_info",
                "getMessage",
            }:
                extra_fields[key] = value

        if extra_fields:
            log_entry["extra"] = extra_fields

        return json.dumps(log_entry, ensure_ascii=False)


class HealthFilter(logging.Filter):
    """Filter to exclude health check logs to reduce noise"""

    def filter(self, record: logging.LogRecord) -> bool:
        # Skip health check requests
        if hasattr(record, "args") and record.args:
            message = str(record.args[0]) if record.args else ""
            if "/api/health" in message or "/health" in message:
                return False
        return True


def setup_production_logging(
    app_name: str = "haptic-api",
    log_level: str = "INFO",
    log_file: Optional[str] = None,
    enable_json: bool = True,
    enable_health_filter: bool = True,
) -> None:
    """
    Setup production logging configuration

    Args:
        app_name: Application name for log identification
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Path to log file (optional)
        enable_json: Enable JSON formatting for structured logs
        enable_health_filter: Filter out health check requests
    """

    # Create logs directory if log file is specified
    if log_file:
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)

    # Base configuration
    config: dict[str, Any] = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "()": JSONFormatter,
            },
            "standard": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "filters": {
            "health_filter": (
                {
                    "()": HealthFilter,
                }
                if enable_health_filter
                else {}
            ),
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": log_level,
                "formatter": "json" if enable_json else "standard",
                "stream": sys.stdout,
            },
        },
        "loggers": {
            # Application loggers
            "haptic_system": {
                "level": log_level,
                "handlers": ["console"],
                "propagate": False,
            },
            "config": {
                "level": log_level,
                "handlers": ["console"],
                "propagate": False,
            },
            "main": {
                "level": log_level,
                "handlers": ["console"],
                "propagate": False,
            },
            # Third-party loggers
            "uvicorn": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False,
            },
            "uvicorn.access": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False,
                "filters": ["health_filter"] if enable_health_filter else [],
            },
            "fastapi": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False,
            },
        },
        "root": {
            "level": log_level,
            "handlers": ["console"],
        },
    }

    # Add file handler if log file is specified
    if log_file:
        config["handlers"]["file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "level": log_level,
            "formatter": "json" if enable_json else "standard",
            "filename": log_file,
            "maxBytes": 50 * 1024 * 1024,  # 50MB
            "backupCount": 5,
            "encoding": "utf-8",
        }

        # Add file handler to all loggers
        for logger_config in config["loggers"].values():
            if "handlers" in logger_config:
                logger_config["handlers"].append("file")
        config["root"]["handlers"].append("file")

    # Apply configuration
    logging.config.dictConfig(config)

    # Log configuration summary
    logger = logging.getLogger(__name__)
    logger.info(
        "Logging configured",
        extra={
            "app_name": app_name,
            "log_level": log_level,
            "json_format": enable_json,
            "log_file": log_file,
            "health_filter": enable_health_filter,
        },
    )


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance with the specified name"""
    return logging.getLogger(name)


# Context manager for adding request context to logs
class LogContext:
    """Context manager for adding request-specific information to logs"""

    def __init__(self, **context):
        self.context = context
        self.old_factory = logging.getLogRecordFactory()

    def __enter__(self):
        def record_factory(*args, **kwargs):
            record = self.old_factory(*args, **kwargs)
            for key, value in self.context.items():
                setattr(record, key, value)
            return record

        logging.setLogRecordFactory(record_factory)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        logging.setLogRecordFactory(self.old_factory)


# Performance monitoring decorator
def log_performance(logger: Optional[logging.Logger] = None):
    """Decorator to log function execution time"""
    import functools
    import time

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            result = None
            error = None

            try:
                result = func(*args, **kwargs)
                return result
            except Exception as e:
                error = e
                raise
            finally:
                execution_time = time.time() - start_time
                log = logger or logging.getLogger(func.__module__)

                log.info(
                    f"Function executed: {func.__name__}",
                    extra={
                        "function": func.__name__,
                        "module": func.__module__,
                        "execution_time_ms": round(execution_time * 1000, 2),
                        "success": error is None,
                        "error_type": type(error).__name__ if error else None,
                    },
                )

        return wrapper

    return decorator


# Security audit logger
def audit_log(event: str, user_id: Optional[str] = None, **extra):
    """Log security and audit events"""
    audit_logger = logging.getLogger("audit")
    audit_logger.info(
        f"AUDIT: {event}",
        extra={
            "event_type": "audit",
            "event": event,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            **extra,
        },
    )
