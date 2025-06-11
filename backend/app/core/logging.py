"""
Structured logging configuration for Scanalyzer.
Provides JSON formatting, colored output, log rotation, and sensitive data masking.
"""

import sys
import logging
import json
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List, Pattern
from logging.handlers import RotatingFileHandler
from contextvars import ContextVar

import structlog
from structlog.processors import (
    TimeStamper,
    add_log_level,
    format_exc_info,
    CallsiteParameterAdder,
)
from structlog.dev import ConsoleRenderer
from structlog.processors import JSONRenderer

from .config import settings


# Context variables for request tracking
request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
user_id_var: ContextVar[Optional[str]] = ContextVar("user_id", default=None)


class SensitiveDataFilter(logging.Filter):
    """Filter to mask sensitive data in logs."""
    
    # Patterns for sensitive data
    SENSITIVE_PATTERNS: List[Pattern] = [
        re.compile(r'"password"\s*:\s*"[^"]*"', re.IGNORECASE),
        re.compile(r'"secret"\s*:\s*"[^"]*"', re.IGNORECASE),
        re.compile(r'"token"\s*:\s*"[^"]*"', re.IGNORECASE),
        re.compile(r'"api_key"\s*:\s*"[^"]*"', re.IGNORECASE),
        re.compile(r'"apikey"\s*:\s*"[^"]*"', re.IGNORECASE),
        re.compile(r'"access_token"\s*:\s*"[^"]*"', re.IGNORECASE),
        re.compile(r'"refresh_token"\s*:\s*"[^"]*"', re.IGNORECASE),
        re.compile(r'"authorization"\s*:\s*"[^"]*"', re.IGNORECASE),
        re.compile(r'"private_key"\s*:\s*"[^"]*"', re.IGNORECASE),
        re.compile(r'"ssn"\s*:\s*"[^"]*"', re.IGNORECASE),
        re.compile(r'"credit_card"\s*:\s*"[^"]*"', re.IGNORECASE),
        # AWS credentials
        re.compile(r'AKIA[0-9A-Z]{16}'),
        re.compile(r'aws_access_key_id\s*=\s*[^\s]+'),
        re.compile(r'aws_secret_access_key\s*=\s*[^\s]+'),
        # Email addresses (optional, can be disabled)
        re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
    ]
    
    MASK = "[REDACTED]"
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Filter and mask sensitive data in log records."""
        if hasattr(record, 'msg'):
            record.msg = self._mask_sensitive_data(str(record.msg))
        
        if hasattr(record, 'args') and record.args:
            record.args = tuple(
                self._mask_sensitive_data(str(arg)) for arg in record.args
            )
        
        return True
    
    def _mask_sensitive_data(self, text: str) -> str:
        """Mask sensitive data in text."""
        for pattern in self.SENSITIVE_PATTERNS:
            text = pattern.sub(self.MASK, text)
        return text


def add_request_context(logger, method_name: str, event_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Add request context to log entries."""
    request_id = request_id_var.get()
    user_id = user_id_var.get()
    
    if request_id:
        event_dict["request_id"] = request_id
    if user_id:
        event_dict["user_id"] = user_id
    
    return event_dict


def add_app_context(logger, method_name: str, event_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Add application context to log entries."""
    event_dict["app_name"] = settings.APP_NAME
    event_dict["app_version"] = settings.APP_VERSION
    event_dict["environment"] = settings.ENVIRONMENT
    return event_dict


def setup_logging() -> None:
    """Configure structured logging for the application."""
    
    # Create logs directory
    settings.LOGS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Configure Python's logging
    log_level = getattr(logging, settings.LOG_LEVEL.upper())
    
    # Create formatters
    if settings.LOG_FORMAT == "json" or settings.is_production:
        renderer = JSONRenderer()
    else:
        # Colored output for development
        renderer = ConsoleRenderer(colors=True)
    
    # Configure processors
    processors = [
        add_log_level,
        TimeStamper(fmt="iso", utc=True),
        add_app_context,
    ]
    
    if settings.LOG_INCLUDE_CONTEXT:
        processors.append(add_request_context)
    
    if settings.is_development:
        processors.append(CallsiteParameterAdder())
    
    processors.extend([
        format_exc_info,
        renderer,
    ])
    
    # Configure structlog
    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    
    # Set up root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.addFilter(SensitiveDataFilter())
    
    # File handler with rotation
    log_file = settings.LOGS_DIR / f"{settings.APP_NAME.lower()}.log"
    file_handler = RotatingFileHandler(
        filename=str(log_file),
        maxBytes=settings.LOG_MAX_SIZE_MB * 1024 * 1024,
        backupCount=settings.LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setLevel(log_level)
    file_handler.addFilter(SensitiveDataFilter())
    
    # Create formatter for standard logging
    if settings.LOG_FORMAT == "json":
        formatter = JsonFormatter()
    else:
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    
    console_handler.setFormatter(formatter)
    file_handler.setFormatter(formatter)
    
    # Add handlers
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)
    
    # Set log levels for third-party libraries
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("aiosqlite").setLevel(logging.WARNING)
    
    # Log startup message
    logger = get_logger(__name__)
    logger.info(
        "Logging system initialized",
        log_level=settings.LOG_LEVEL,
        log_format=settings.LOG_FORMAT,
        log_file=str(log_file),
    )


class JsonFormatter(logging.Formatter):
    """JSON formatter for standard logging."""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields
        for key, value in record.__dict__.items():
            if key not in [
                "name", "msg", "args", "created", "msecs", "levelname", "levelno",
                "pathname", "filename", "module", "funcName", "lineno", "exc_info",
                "exc_text", "stack_info", "processName", "process", "threadName",
                "thread", "relativeCreated", "getMessage", "message"
            ]:
                log_data[key] = value
        
        return json.dumps(log_data, default=str)


def get_logger(name: str) -> structlog.BoundLogger:
    """Get a structured logger instance."""
    return structlog.get_logger(name)


def log_function_call(func_name: str, **kwargs) -> None:
    """Log function calls for debugging."""
    if settings.is_development:
        logger = get_logger(__name__)
        logger.debug(
            f"Function called: {func_name}",
            function=func_name,
            parameters=kwargs,
        )


def log_database_query(query: str, duration_ms: float) -> None:
    """Log database queries with performance metrics."""
    logger = get_logger("database")
    
    if duration_ms > 1000:  # Slow query threshold: 1 second
        logger.warning(
            "Slow database query",
            query=query[:200],  # Truncate long queries
            duration_ms=duration_ms,
        )
    elif settings.is_development:
        logger.debug(
            "Database query executed",
            query=query[:200],
            duration_ms=duration_ms,
        )


def log_parser_activity(
    parser_name: str,
    file_name: str,
    status: str,
    duration_ms: Optional[float] = None,
    findings_count: Optional[int] = None,
    error: Optional[str] = None,
) -> None:
    """Log parser activity with metrics."""
    logger = get_logger("parser")
    
    log_data = {
        "parser": parser_name,
        "file": file_name,
        "status": status,
    }
    
    if duration_ms is not None:
        log_data["duration_ms"] = duration_ms
    if findings_count is not None:
        log_data["findings_count"] = findings_count
    if error:
        log_data["error"] = error
    
    if status == "error":
        logger.error("Parser failed", **log_data)
    elif status == "success":
        logger.info("Parser completed", **log_data)
    else:
        logger.debug("Parser activity", **log_data)


def log_memory_usage(
    component: str,
    memory_mb: float,
    threshold_mb: Optional[float] = None,
) -> None:
    """Log memory usage metrics."""
    logger = get_logger("memory")
    
    log_data = {
        "component": component,
        "memory_mb": memory_mb,
    }
    
    if threshold_mb and memory_mb > threshold_mb:
        log_data["threshold_mb"] = threshold_mb
        logger.warning("High memory usage detected", **log_data)
    elif settings.is_development:
        logger.debug("Memory usage", **log_data)


# Initialize logging when module is imported
setup_logging()