"""
Storage Service for Scanalyzer.

Handles secure file uploads with validation, virus scanning,
and atomic writes to prevent corruption.
"""

import os
import hashlib
import tempfile
import asyncio
from pathlib import Path
from datetime import datetime
from typing import AsyncIterator, Optional, Dict, Any
from dataclasses import dataclass

import aiofiles
from fastapi import UploadFile

from app.core.config import get_settings
from app.utils.file_utils import (
    safe_path_join,
    validate_mime_type,
    calculate_file_hash,
    chunk_file_reader
)
from app.core.logging import get_logger

# Try to import clamd for virus scanning
try:
    import clamd
    CLAMD_AVAILABLE = True
except ImportError:
    CLAMD_AVAILABLE = False

logger = get_logger(__name__)


@dataclass
class StorageResult:
    """Result of a storage operation."""
    success: bool
    file_id: Optional[str] = None
    file_path: Optional[Path] = None
    stored_filename: Optional[str] = None
    file_hash: Optional[str] = None
    file_size: Optional[int] = None
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class StorageService:
    """
    Service for handling file storage operations.
    
    Features:
    - Secure file upload with validation
    - Virus scanning (when clamd available)
    - File type validation
    - Size limit enforcement
    - Atomic writes
    - Unique naming with deduplication
    """
    
    # Allowed MIME types for security reports
    ALLOWED_MIME_TYPES = {
        'application/json',
        'application/xml', 
        'text/xml',
        'application/pdf',
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/html'
    }
    
    # Maximum file size (100MB)
    MAX_FILE_SIZE = 100 * 1024 * 1024
    
    def __init__(self, upload_dir: Optional[str] = None):
        settings = get_settings()
        self.upload_dir = Path(upload_dir or settings.UPLOADS_DIR)
        self.virus_scanner = None
        self._initialized = False
        
    async def initialize(self):
        """Initialize storage service."""
        # Create upload directory if it doesn't exist
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize virus scanner if available
        if CLAMD_AVAILABLE:
            try:
                self.virus_scanner = clamd.ClamdNetworkSocket()
                # Test connection
                self.virus_scanner.ping()
                logger.info("Virus scanner initialized")
            except Exception as e:
                logger.warning(f"Could not connect to clamd: {e}")
                self.virus_scanner = None
                
        self._initialized = True
        
    async def cleanup(self):
        """Cleanup resources."""
        self._initialized = False
        
    async def save_upload(self, file: UploadFile) -> StorageResult:
        """
        Save an uploaded file with validation.
        
        Args:
            file: The uploaded file
            
        Returns:
            StorageResult with success status and file info
        """
        if not self._initialized:
            await self.initialize()
            
        try:
            # Validate file size
            if hasattr(file, 'size') and file.size > self.MAX_FILE_SIZE:
                return StorageResult(
                    success=False,
                    error=f"File size ({file.size} bytes) exceeds maximum size ({self.MAX_FILE_SIZE} bytes)"
                )
                
            # Read file content
            content = await file.read()
            await file.seek(0)  # Reset for potential re-read
            
            # Validate actual size
            if len(content) > self.MAX_FILE_SIZE:
                return StorageResult(
                    success=False,
                    error=f"File size ({len(content)} bytes) exceeds maximum size ({self.MAX_FILE_SIZE} bytes)"
                )
                
            # Validate MIME type
            try:
                mime_type = validate_mime_type(content, file.filename)
                if mime_type not in self.ALLOWED_MIME_TYPES:
                    raise ValueError(f"File type not allowed: {mime_type}")
            except ValueError as e:
                return StorageResult(
                    success=False,
                    error=str(e)
                )
                
            # Virus scan if available
            if self.virus_scanner:
                try:
                    scan_result = self.virus_scanner.scan_stream(content)
                    if scan_result:
                        status = scan_result.get('stream', ('OK', None))
                        if status[0] != 'OK':
                            return StorageResult(
                                success=False,
                                error=f"Virus detected: {status[1]}"
                            )
                except Exception as e:
                    logger.warning(f"Virus scan failed: {e}")
                    # Continue without virus scanning
                    
            # Calculate file hash
            file_hash = hashlib.sha256(content).hexdigest()
            
            # Generate unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            hash_prefix = file_hash[:8]
            safe_filename = Path(file.filename).name  # Remove any directory components
            stored_filename = f"{timestamp}_{hash_prefix}_{safe_filename}"
            
            # Ensure unique name
            file_path = self.upload_dir / stored_filename
            counter = 0
            while file_path.exists():
                counter += 1
                base_name = f"{timestamp}_{hash_prefix}_{counter}_{safe_filename}"
                file_path = self.upload_dir / base_name
                stored_filename = base_name
                
            # Atomic write using temporary file
            temp_fd, temp_path = tempfile.mkstemp(
                dir=self.upload_dir,
                prefix=".tmp_",
                suffix=f"_{safe_filename}"
            )
            
            try:
                # Write to temporary file
                async with aiofiles.open(temp_path, 'wb') as f:
                    await f.write(content)
                    
                # Atomic rename
                os.replace(temp_path, file_path)
                
                # Generate file ID (hash of path)
                file_id = hashlib.sha256(str(file_path).encode()).hexdigest()[:16]
                
                return StorageResult(
                    success=True,
                    file_id=file_id,
                    file_path=file_path,
                    stored_filename=stored_filename,
                    file_hash=file_hash,
                    file_size=len(content),
                    metadata={
                        'original_filename': file.filename,
                        'mime_type': mime_type,
                        'upload_timestamp': datetime.now().isoformat()
                    }
                )
                
            except Exception as e:
                # Clean up temporary file on error
                try:
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)
                except:
                    pass
                raise
                
        except OSError as e:
            if "No space left on device" in str(e):
                return StorageResult(
                    success=False,
                    error="Insufficient disk space"
                )
            elif "Permission denied" in str(e):
                return StorageResult(
                    success=False,
                    error="Permission denied - cannot write to storage directory"
                )
            else:
                logger.error(f"Storage error: {e}")
                return StorageResult(
                    success=False,
                    error=f"Storage error: {str(e)}"
                )
                
        except Exception as e:
            logger.error(f"Unexpected error during file upload: {e}")
            return StorageResult(
                success=False,
                error=f"Upload failed: {str(e)}"
            )
            
    async def get_file_stream(self, file_id: str) -> AsyncIterator[bytes]:
        """
        Stream file content in chunks.
        
        Args:
            file_id: The file identifier
            
        Yields:
            Chunks of file content
        """
        # Find file by ID
        file_path = None
        for path in self.upload_dir.iterdir():
            if path.is_file():
                path_id = hashlib.sha256(str(path).encode()).hexdigest()[:16]
                if path_id == file_id:
                    file_path = path
                    break
                    
        if not file_path or not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_id}")
            
        # Stream file content
        async for chunk in chunk_file_reader(file_path):
            yield chunk
            
    async def delete_file(self, file_id: str) -> bool:
        """
        Delete a file by ID.
        
        Args:
            file_id: The file identifier
            
        Returns:
            True if deleted, False otherwise
        """
        try:
            # Find file by ID
            for path in self.upload_dir.iterdir():
                if path.is_file():
                    path_id = hashlib.sha256(str(path).encode()).hexdigest()[:16]
                    if path_id == file_id:
                        path.unlink()
                        logger.info(f"Deleted file: {path.name}")
                        return True
                        
            return False
            
        except Exception as e:
            logger.error(f"Error deleting file {file_id}: {e}")
            return False
            
    async def get_storage_stats(self) -> Dict[str, Any]:
        """
        Get storage statistics.
        
        Returns:
            Dictionary with storage stats
        """
        try:
            total_size = 0
            file_count = 0
            oldest_file = None
            newest_file = None
            
            for path in self.upload_dir.iterdir():
                if path.is_file():
                    file_count += 1
                    total_size += path.stat().st_size
                    
                    mtime = datetime.fromtimestamp(path.stat().st_mtime)
                    if oldest_file is None or mtime < oldest_file:
                        oldest_file = mtime
                    if newest_file is None or mtime > newest_file:
                        newest_file = mtime
                        
            # Get disk usage
            stat = os.statvfs(self.upload_dir)
            total_space = stat.f_blocks * stat.f_frsize
            free_space = stat.f_bavail * stat.f_frsize
            used_space = total_space - free_space
            
            return {
                'file_count': file_count,
                'total_size': total_size,
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'oldest_file': oldest_file.isoformat() if oldest_file else None,
                'newest_file': newest_file.isoformat() if newest_file else None,
                'disk_total': total_space,
                'disk_used': used_space,
                'disk_free': free_space,
                'disk_usage_percent': round((used_space / total_space) * 100, 2)
            }
            
        except Exception as e:
            logger.error(f"Error getting storage stats: {e}")
            return {
                'error': str(e)
            }