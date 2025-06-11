"""
Cleanup Service for Scanalyzer.

Handles automatic file cleanup with retention policies,
orphaned record cleanup, and storage monitoring.
"""

import os
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.session import get_db_context
from app.models import Report
from app.services.storage_service import StorageService

logger = get_logger(__name__)


class CleanupService:
    """
    Service for automatic file cleanup and retention management.
    
    Features:
    - 3-month retention enforcement
    - Daily scheduled cleanup
    - Orphaned database record cleanup
    - Concurrent run prevention
    - Storage usage monitoring
    """
    
    # Default retention period (3 months)
    RETENTION_DAYS = 90
    
    def __init__(
        self,
        storage_service: StorageService,
        retention_days: Optional[int] = None,
        cleanup_hour: int = 3,
        cleanup_minute: int = 0
    ):
        """
        Initialize cleanup service.
        
        Args:
            storage_service: Storage service instance
            retention_days: Number of days to retain files (default: 90)
            cleanup_hour: Hour to run cleanup (default: 3 AM)
            cleanup_minute: Minute to run cleanup (default: 0)
        """
        self.storage_service = storage_service
        self.retention_days = retention_days or self.RETENTION_DAYS
        self.cleanup_hour = cleanup_hour
        self.cleanup_minute = cleanup_minute
        
        # Scheduler for automatic cleanup
        self.scheduler = AsyncIOScheduler()
        
        # Lock to prevent concurrent runs
        self._cleanup_lock = asyncio.Lock()
        self._is_running = False
        
        # Schedule daily cleanup
        self._schedule_cleanup()
        
    def _schedule_cleanup(self):
        """Schedule daily cleanup job."""
        # Create cron trigger for daily run
        trigger = CronTrigger(
            hour=self.cleanup_hour,
            minute=self.cleanup_minute,
            second=0
        )
        
        # Add job to scheduler
        self.scheduler.add_job(
            self.run_cleanup,
            trigger=trigger,
            id='daily_cleanup',
            name='Daily file cleanup',
            replace_existing=True
        )
        
        # Start scheduler
        self.scheduler.start()
        
        logger.info(
            f"Cleanup scheduled daily at {self.cleanup_hour:02d}:{self.cleanup_minute:02d}"
        )
        
    async def run_cleanup(self) -> bool:
        """
        Run cleanup process.
        
        Returns:
            True if cleanup ran, False if skipped (already running)
        """
        # Try to acquire lock
        if self._cleanup_lock.locked():
            logger.warning("Cleanup already running, skipping")
            return False
            
        async with self._cleanup_lock:
            self._is_running = True
            try:
                logger.info("Starting cleanup process")
                
                # Clean old files
                files_cleaned = await self.cleanup_old_files()
                logger.info(f"Cleaned {files_cleaned} old files")
                
                # Clean orphaned database records
                records_cleaned = await self.cleanup_orphaned_records()
                logger.info(f"Cleaned {records_cleaned} orphaned records")
                
                # Check storage usage
                await self.check_storage_usage()
                
                logger.info("Cleanup process completed")
                return True
                
            except Exception as e:
                logger.error(f"Cleanup process failed: {e}")
                # Could send email notification here
                raise
                
            finally:
                self._is_running = False
                
    async def cleanup_old_files(self) -> int:
        """
        Remove files older than retention period.
        
        Returns:
            Number of files cleaned
        """
        cleaned_count = 0
        cutoff_date = datetime.now() - timedelta(days=self.retention_days)
        
        try:
            upload_dir = self.storage_service.upload_dir
            
            for file_path in upload_dir.iterdir():
                if not file_path.is_file():
                    continue
                    
                try:
                    # Check file age
                    mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                    
                    if mtime < cutoff_date:
                        # Try to delete file
                        try:
                            file_path.unlink()
                            cleaned_count += 1
                            logger.debug(f"Deleted old file: {file_path.name}")
                            
                        except PermissionError:
                            logger.warning(f"Cannot delete locked file: {file_path.name}")
                        except Exception as e:
                            logger.error(f"Error deleting file {file_path.name}: {e}")
                            
                except Exception as e:
                    logger.error(f"Error checking file {file_path.name}: {e}")
                    
        except Exception as e:
            logger.error(f"Error during file cleanup: {e}")
            
        return cleaned_count
        
    async def cleanup_orphaned_records(self) -> int:
        """
        Clean database records without corresponding files.
        
        Returns:
            Number of records cleaned
        """
        cleaned_count = 0
        
        async with get_db_context() as db:
            try:
                # Get all reports with file paths
                result = await db.execute(
                    select(Report).where(
                        Report.file_path.isnot(None)
                    )
                )
                reports = result.scalars().all()
                
                for report in reports:
                    # Check if file exists
                    file_path = Path(report.file_path)
                    
                    if not file_path.exists():
                        # Mark as failed or delete
                        if report.status != 'failed':
                            report.status = 'failed'
                            report.error_message = 'File not found'
                            logger.info(
                                f"Marked report {report.id} as failed - file missing"
                            )
                        cleaned_count += 1
                        
                await db.commit()
                
            except Exception as e:
                logger.error(f"Error cleaning orphaned records: {e}")
                await db.rollback()
                
        return cleaned_count
        
    async def check_storage_usage(self) -> Dict[str, Any]:
        """
        Check storage usage and log warnings if needed.
        
        Returns:
            Storage statistics
        """
        stats = await self.storage_service.get_storage_stats()
        
        if 'disk_usage_percent' in stats:
            usage = stats['disk_usage_percent']
            
            # Log warnings at different thresholds
            if usage > 90:
                logger.error(f"CRITICAL: Disk usage at {usage}%")
                # Could send email alert here
            elif usage > 80:
                logger.warning(f"High disk usage: {usage}%")
            elif usage > 70:
                logger.info(f"Disk usage: {usage}%")
                
        return stats
        
    async def cleanup_by_criteria(
        self,
        tool_name: Optional[str] = None,
        status: Optional[str] = None,
        older_than_days: Optional[int] = None
    ) -> int:
        """
        Clean files matching specific criteria.
        
        Args:
            tool_name: Clean files from specific tool
            status: Clean files with specific status
            older_than_days: Clean files older than X days
            
        Returns:
            Number of files cleaned
        """
        cleaned_count = 0
        
        async with get_db_context() as db:
            try:
                # Build query
                query = select(Report)
                conditions = []
                
                if tool_name:
                    conditions.append(Report.tool_name == tool_name)
                if status:
                    conditions.append(Report.status == status)
                if older_than_days:
                    cutoff = datetime.now() - timedelta(days=older_than_days)
                    conditions.append(Report.created_at < cutoff)
                    
                if conditions:
                    query = query.where(and_(*conditions))
                    
                # Get matching reports
                result = await db.execute(query)
                reports = result.scalars().all()
                
                for report in reports:
                    # Delete file if exists
                    if report.file_path:
                        file_path = Path(report.file_path)
                        if file_path.exists():
                            try:
                                file_path.unlink()
                                cleaned_count += 1
                            except Exception as e:
                                logger.error(
                                    f"Error deleting file {file_path}: {e}"
                                )
                                
                    # Delete report record
                    await db.delete(report)
                    
                await db.commit()
                logger.info(
                    f"Cleaned {cleaned_count} files by criteria: "
                    f"tool={tool_name}, status={status}, "
                    f"older_than={older_than_days} days"
                )
                
            except Exception as e:
                logger.error(f"Error in criteria cleanup: {e}")
                await db.rollback()
                
        return cleaned_count
        
    def shutdown(self):
        """Shutdown cleanup service."""
        logger.info("Shutting down cleanup service")
        self.scheduler.shutdown()
        
    async def force_cleanup(self) -> Dict[str, int]:
        """
        Force immediate cleanup (for testing/maintenance).
        
        Returns:
            Cleanup statistics
        """
        logger.info("Forcing immediate cleanup")
        
        files_cleaned = await self.cleanup_old_files()
        records_cleaned = await self.cleanup_orphaned_records()
        
        return {
            'files_cleaned': files_cleaned,
            'records_cleaned': records_cleaned,
            'timestamp': datetime.now().isoformat()
        }