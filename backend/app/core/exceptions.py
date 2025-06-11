"""
Custom exception classes for Scanalyzer.
Provides structured error handling with user-friendly messages.
"""

from typing import Optional, Dict, Any
from fastapi import status


class ScanalyzerException(Exception):
    """Base exception class for all Scanalyzer exceptions."""
    
    def __init__(
        self,
        message: str,
        error_code: str = "SCANALYZER_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ValidationException(ScanalyzerException):
    """Exception raised for validation errors."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=details,
        )


class ResourceNotFoundException(ScanalyzerException):
    """Exception raised when a requested resource is not found."""
    
    def __init__(
        self,
        resource_type: str,
        resource_id: Optional[str] = None,
        message: Optional[str] = None,
    ):
        self.resource_type = resource_type
        self.resource_id = resource_id
        
        if not message:
            if resource_id:
                message = f"{resource_type} with ID '{resource_id}' not found"
            else:
                message = f"{resource_type} not found"
        
        super().__init__(
            message=message,
            error_code="RESOURCE_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"resource_type": resource_type, "resource_id": resource_id},
        )


class ProcessingException(ScanalyzerException):
    """Exception raised during report or finding processing."""
    
    def __init__(
        self,
        message: str,
        processor: Optional[str] = None,
        file_name: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        error_details = details or {}
        if processor:
            error_details["processor"] = processor
        if file_name:
            error_details["file_name"] = file_name
        
        super().__init__(
            message=message,
            error_code="PROCESSING_ERROR",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=error_details,
        )


class ParserException(ProcessingException):
    """Exception raised by parsers during report parsing."""
    
    def __init__(
        self,
        message: str,
        parser_name: str,
        file_name: Optional[str] = None,
        line_number: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        error_details = details or {}
        if line_number:
            error_details["line_number"] = line_number
        
        super().__init__(
            message=message,
            processor=parser_name,
            file_name=file_name,
            details=error_details,
        )


class StorageException(ScanalyzerException):
    """Exception raised for storage-related errors."""
    
    def __init__(
        self,
        message: str,
        path: Optional[str] = None,
        operation: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        error_details = details or {}
        if path:
            error_details["path"] = path
        if operation:
            error_details["operation"] = operation
        
        super().__init__(
            message=message,
            error_code="STORAGE_ERROR",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=error_details,
        )


class FileSizeException(ValidationException):
    """Exception raised when uploaded file exceeds size limits."""
    
    def __init__(
        self,
        file_name: str,
        file_size: int,
        max_size: int,
    ):
        message = (
            f"File '{file_name}' size ({file_size / 1024 / 1024:.2f} MB) "
            f"exceeds maximum allowed size ({max_size / 1024 / 1024:.2f} MB)"
        )
        
        super().__init__(
            message=message,
            details={
                "file_name": file_name,
                "file_size": file_size,
                "max_size": max_size,
            },
        )


class FileTypeException(ValidationException):
    """Exception raised for unsupported file types."""
    
    def __init__(
        self,
        file_name: str,
        file_type: str,
        allowed_types: list,
    ):
        message = (
            f"File type '{file_type}' is not supported. "
            f"Allowed types: {', '.join(allowed_types)}"
        )
        
        super().__init__(
            message=message,
            details={
                "file_name": file_name,
                "file_type": file_type,
                "allowed_types": allowed_types,
            },
        )


class ParseError(ProcessingException):
    """Exception raised when parsing a file fails."""
    pass


class MemoryLimitException(ProcessingException):
    """Exception raised when memory limit is exceeded."""
    
    def __init__(
        self,
        current_usage_mb: float,
        limit_mb: float,
        operation: Optional[str] = None,
    ):
        message = (
            f"Memory limit exceeded: {current_usage_mb:.2f} MB / {limit_mb:.2f} MB"
        )
        
        super().__init__(
            message=message,
            details={
                "current_usage_mb": current_usage_mb,
                "limit_mb": limit_mb,
                "operation": operation,
            },
        )


class AuthenticationException(ScanalyzerException):
    """Exception raised for authentication failures."""
    
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(
            message=message,
            error_code="AUTHENTICATION_ERROR",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class AuthorizationException(ScanalyzerException):
    """Exception raised for authorization failures."""
    
    def __init__(
        self,
        message: str = "You don't have permission to perform this action",
        resource: Optional[str] = None,
        action: Optional[str] = None,
    ):
        details = {}
        if resource:
            details["resource"] = resource
        if action:
            details["action"] = action
        
        super().__init__(
            message=message,
            error_code="AUTHORIZATION_ERROR",
            status_code=status.HTTP_403_FORBIDDEN,
            details=details,
        )


class RateLimitException(ScanalyzerException):
    """Exception raised when rate limit is exceeded."""
    
    def __init__(
        self,
        message: str = "Rate limit exceeded",
        limit: Optional[int] = None,
        window: Optional[str] = None,
    ):
        details = {}
        if limit:
            details["limit"] = limit
        if window:
            details["window"] = window
        
        super().__init__(
            message=message,
            error_code="RATE_LIMIT_ERROR",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=details,
        )