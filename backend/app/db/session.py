"""
Database session management with async support.
"""

from typing import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from .base import get_session as base_get_session
from ..core.logging import get_logger

logger = get_logger(__name__)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for FastAPI to get database session.
    
    Yields:
        AsyncSession: Database session with automatic cleanup
    """
    async for session in base_get_session():
        yield session


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Context manager for database operations outside of FastAPI.
    
    Example:
        async with get_db_session() as session:
            result = await session.execute(query)
    """
    async for session in base_get_session():
        try:
            yield session
            await session.commit()
        except SQLAlchemyError as e:
            await session.rollback()
            logger.error(f"Database error: {str(e)}", exc_info=True)
            raise
        except Exception as e:
            await session.rollback()
            logger.error(f"Unexpected error in database session: {str(e)}", exc_info=True)
            raise
        finally:
            await session.close()


async def check_db_connection() -> bool:
    """
    Check if database connection is healthy.
    
    Returns:
        bool: True if connection is healthy, False otherwise
    """
    try:
        async with get_db_session() as session:
            # Execute a simple query
            result = await session.execute("SELECT 1")
            return result.scalar() == 1
    except Exception as e:
        logger.error(f"Database connection check failed: {str(e)}")
        return False


class DatabaseTransactionManager:
    """
    Manager for complex database transactions.
    
    Provides utilities for handling nested transactions and savepoints.
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self._savepoint_counter = 0
    
    async def savepoint(self) -> str:
        """Create a savepoint in the current transaction."""
        self._savepoint_counter += 1
        savepoint_name = f"sp_{self._savepoint_counter}"
        await self.session.execute(f"SAVEPOINT {savepoint_name}")
        return savepoint_name
    
    async def release_savepoint(self, savepoint_name: str) -> None:
        """Release a savepoint."""
        await self.session.execute(f"RELEASE SAVEPOINT {savepoint_name}")
    
    async def rollback_to_savepoint(self, savepoint_name: str) -> None:
        """Rollback to a specific savepoint."""
        await self.session.execute(f"ROLLBACK TO SAVEPOINT {savepoint_name}")
    
    @asynccontextmanager
    async def nested_transaction(self):
        """
        Context manager for nested transactions using savepoints.
        
        Example:
            async with transaction_manager.nested_transaction():
                # Do some operations
                if error_condition:
                    raise Exception()  # Will rollback to savepoint
        """
        savepoint = await self.savepoint()
        try:
            yield
            await self.release_savepoint(savepoint)
        except Exception:
            await self.rollback_to_savepoint(savepoint)
            raise