"""
File utilities for Scanalyzer.

Provides secure file operations, validation, and helper functions.
"""

import os
import hashlib
import mimetypes
from pathlib import Path
from typing import Union, AsyncIterator, BinaryIO
import aiofiles

# Try to import python-magic for better MIME detection
try:
    import magic
    MAGIC_AVAILABLE = True
except ImportError:
    MAGIC_AVAILABLE = False


def safe_path_join(base_path: Union[str, Path], *paths: str) -> Path:
    """
    Safely join paths preventing directory traversal attacks.
    
    Args:
        base_path: Base directory path
        *paths: Path components to join
        
    Returns:
        Safe joined path
        
    Raises:
        ValueError: If resulting path is outside base directory
    """
    base = Path(base_path).resolve()
    
    # Join paths
    joined = base
    for path in paths:
        # Reject absolute paths
        if os.path.isabs(path):
            raise ValueError(f"Absolute path not allowed: {path}")
            
        # Reject paths with parent directory references
        if '..' in Path(path).parts:
            raise ValueError(f"Parent directory reference not allowed: {path}")
            
        joined = joined / path
        
    # Resolve to handle any sneaky symlinks
    resolved = joined.resolve()
    
    # Ensure resolved path is within base directory
    try:
        resolved.relative_to(base)
    except ValueError:
        raise ValueError(
            f"Path traversal detected: {resolved} is outside {base}"
        )
        
    return resolved


def calculate_file_hash(
    file_obj: BinaryIO,
    algorithm: str = 'sha256',
    chunk_size: int = 8192
) -> str:
    """
    Calculate hash of file content.
    
    Args:
        file_obj: File-like object to hash
        algorithm: Hash algorithm (default: sha256)
        chunk_size: Size of chunks to read
        
    Returns:
        Hex digest of file hash
    """
    hasher = hashlib.new(algorithm)
    
    # Ensure we're at the beginning
    file_obj.seek(0)
    
    # Read and hash in chunks
    while True:
        chunk = file_obj.read(chunk_size)
        if not chunk:
            break
        hasher.update(chunk)
        
    # Reset file position
    file_obj.seek(0)
    
    return hasher.hexdigest()


def validate_mime_type(content: bytes, filename: str) -> str:
    """
    Validate MIME type matches file content.
    
    Args:
        content: File content (at least first 2048 bytes)
        filename: Original filename
        
    Returns:
        Detected MIME type
        
    Raises:
        ValueError: If MIME type doesn't match extension
    """
    # Get expected MIME from extension
    expected_mime, _ = mimetypes.guess_type(filename)
    
    # Detect actual MIME from content
    if MAGIC_AVAILABLE:
        # Use python-magic for accurate detection
        try:
            mime = magic.from_buffer(content[:2048], mime=True)
        except Exception:
            # Fallback to basic detection if magic fails
            mime = _detect_mime_basic(content)
    else:
        # Fallback to basic detection
        mime = _detect_mime_basic(content)
        
    # Special handling for some types
    if mime == 'text/plain':
        # Could be JSON, CSV, etc.
        if filename.endswith('.json'):
            # Check if valid JSON
            try:
                import json
                json.loads(content.decode('utf-8', errors='ignore'))
                mime = 'application/json'
            except:
                pass
        elif filename.endswith('.csv'):
            mime = 'text/csv'
        elif filename.endswith('.xml'):
            # Check for XML declaration
            if content.startswith(b'<?xml'):
                mime = 'application/xml'
                
    # Validate against expected
    if expected_mime and mime:
        # Allow some flexibility
        allowed_mismatches = {
            ('text/xml', 'application/xml'),
            ('application/xml', 'text/xml'),
            ('text/plain', 'application/json'),
            ('text/plain', 'text/csv'),
            ('application/octet-stream', expected_mime)  # Generic binary
        }
        
        if (mime, expected_mime) not in allowed_mismatches and \
           (expected_mime, mime) not in allowed_mismatches and \
           mime != expected_mime:
            # Check for dangerous mismatches
            dangerous_types = {
                'application/x-executable',
                'application/x-msdownload',
                'application/x-msdos-program'
            }
            
            if mime in dangerous_types:
                raise ValueError(
                    f"MIME type mismatch: expected {expected_mime}, "
                    f"got dangerous type {mime}"
                )
                
    return mime


def _detect_mime_basic(content: bytes) -> str:
    """
    Basic MIME type detection from magic bytes.
    
    Args:
        content: File content
        
    Returns:
        Detected MIME type or 'application/octet-stream'
    """
    # Check common magic bytes
    magic_bytes = {
        b'%PDF': 'application/pdf',
        b'PK\x03\x04': 'application/zip',  # Also XLSX, DOCX
        b'<?xml': 'application/xml',
        b'<html': 'text/html',
        b'<HTML': 'text/html',
        b'MZ\x90': 'application/x-msdownload',  # EXE (with more specific check)
        b'MZ': 'application/x-msdownload',  # EXE
        b'\x7fELF': 'application/x-executable',  # Linux ELF
    }
    
    for magic, mime in magic_bytes.items():
        if content.startswith(magic):
            return mime
            
    # Check if it's text
    try:
        content[:1024].decode('utf-8')
        return 'text/plain'
    except:
        return 'application/octet-stream'


async def chunk_file_reader(
    file_path: Union[str, Path],
    chunk_size: int = 1024 * 1024  # 1MB default
) -> AsyncIterator[bytes]:
    """
    Read file in chunks asynchronously.
    
    Args:
        file_path: Path to file
        chunk_size: Size of chunks to yield
        
    Yields:
        Chunks of file content
    """
    file_path = Path(file_path)
    
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
        
    async with aiofiles.open(file_path, 'rb') as f:
        while True:
            chunk = await f.read(chunk_size)
            if not chunk:
                break
            yield chunk


def get_file_info(file_path: Union[str, Path]) -> dict:
    """
    Get file information.
    
    Args:
        file_path: Path to file
        
    Returns:
        Dictionary with file info
    """
    path = Path(file_path)
    
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
        
    stat = path.stat()
    
    return {
        'name': path.name,
        'size': stat.st_size,
        'size_mb': round(stat.st_size / (1024 * 1024), 2),
        'created': stat.st_ctime,
        'modified': stat.st_mtime,
        'is_file': path.is_file(),
        'is_dir': path.is_dir(),
        'extension': path.suffix.lower()
    }


def format_file_size(size_bytes: int) -> str:
    """
    Format file size in human-readable format.
    
    Args:
        size_bytes: Size in bytes
        
    Returns:
        Formatted size string
    """
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
        
    return f"{size_bytes:.2f} PB"