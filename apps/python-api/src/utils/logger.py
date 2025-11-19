"""
Logging configuration using Loguru

This module provides centralized logging setup with colorization and structured output
"""
import sys
from loguru import logger
from typing import Dict, Any


def setup_logger(
    level: str = "INFO",
    log_file: str = None,
    rotation: str = "500 MB",
    retention: str = "10 days",
    format_string: str = None
) -> None:
    """
    Configure Loguru logger with custom settings

    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Path to log file (if None, only console logging)
        rotation: When to rotate log file (e.g., "500 MB", "00:00", "1 week")
        retention: How long to keep log files (e.g., "10 days", "1 month")
        format_string: Custom format string (if None, uses default)

    Default format includes:
    - Timestamp (with timezone)
    - Log level (colorized)
    - Module and function name
    - Line number
    - Message
    """

    # Remove default handler
    logger.remove()

    # Default format if not provided
    if format_string is None:
        format_string = (
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
            "<level>{message}</level>"
        )

    # Add console handler with colorization
    logger.add(
        sys.stderr,
        level=level,
        format=format_string,
        colorize=True,
        backtrace=True,
        diagnose=True,
        enqueue=True  # Thread-safe
    )

    # Add file handler if log_file is specified
    if log_file:
        logger.add(
            log_file,
            level=level,
            format=format_string,
            rotation=rotation,
            retention=retention,
            compression="zip",
            backtrace=True,
            diagnose=True,
            enqueue=True
        )

    logger.info(f"Logger initialized with level: {level}")


def get_logger_config() -> Dict[str, Any]:
    """Get current logger configuration"""
    return {
        "level": logger._core.min_level,
        "handlers": len(logger._core.handlers)
    }


def set_log_level(level: str) -> None:
    """
    Dynamically change log level

    Args:
        level: New logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    """
    # Remove all handlers and re-add with new level
    current_handlers = list(logger._core.handlers.keys())
    for handler_id in current_handlers:
        logger.remove(handler_id)

    # Re-setup with new level
    setup_logger(level=level)
    logger.info(f"Log level changed to: {level}")


# Initialize logger with default settings when module is imported
setup_logger(level="INFO")
