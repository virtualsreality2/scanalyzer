"""
Database configuration with async SQLAlchemy support.
Optimized for desktop application with proper connection management.
"""

from typing import AsyncGenerator, Optional
import asyncio
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    AsyncEngine,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool, QueuePool, StaticPool
from sqlalchemy import event, inspect
from sqlalchemy.engine import Engine

from ..core.config import settings
from ..core.logging import get_logger, log_database_query


logger = get_logger(__name__)

# Base class for all models
Base = declarative_base()

# Global engine and session factory
_engine: Optional[AsyncEngine] = None
_async_session_factory: Optional[async_sessionmaker] = None


def get_pool_class():
    """
    Get appropriate connection pool class based on environment.
    Desktop apps should use StaticPool or small QueuePool.
    """
    if settings.is_development:
        # Use StaticPool for development (single connection)
        return StaticPool
    else:
        # Use QueuePool with limited size for production
        return QueuePool


def create_engine() -> AsyncEngine:
    """Create async SQLAlchemy engine with optimized settings for desktop app."""
    
    pool_class = get_pool_class()
    
    # Engine arguments optimized for desktop application
    engine_args = {
        "echo": settings.is_development and settings.LOG_LEVEL == "DEBUG",
        "future": True,
        "pool_pre_ping": True,  # Verify connections before use
        "connect_args": {
            "check_same_thread": False,  # SQLite specific
            "timeout": 30,  # Connection timeout
        },
    }
    
    # Configure connection pool
    if pool_class == StaticPool:
        engine_args["poolclass"] = StaticPool
    elif pool_class == QueuePool:
        engine_args.update({
            "poolclass": QueuePool,
            "pool_size": settings.DATABASE_POOL_SIZE,
            "max_overflow": settings.DATABASE_MAX_OVERFLOW,
            "pool_timeout": settings.DATABASE_POOL_TIMEOUT,
            "pool_recycle": settings.DATABASE_POOL_RECYCLE,
        })
    
    # Create engine
    engine = create_async_engine(
        settings.DATABASE_URL,
        **engine_args
    )
    
    logger.info(
        "Database engine created",
        url=settings.DATABASE_URL.split("@")[-1],  # Log URL without credentials
        pool_class=pool_class.__name__,
        pool_size=settings.DATABASE_POOL_SIZE,
    )
    
    return engine


async def init_db() -> None:
    """Initialize database and create tables."""
    global _engine, _async_session_factory
    
    try:
        # Create engine
        _engine = create_engine()
        
        # Create session factory
        _async_session_factory = async_sessionmaker(
            _engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
        
        # Import all models to ensure they're registered
        from . import models  # noqa
        
        # Create all tables
        async with _engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        logger.info("Database initialized successfully")
        
        # Run migrations if needed
        await check_and_run_migrations()
        
    except Exception as e:
        logger.error("Failed to initialize database", error=str(e))
        raise


async def close_db() -> None:
    """Close database connections and cleanup."""
    global _engine, _async_session_factory
    
    if _engine:
        await _engine.dispose()
        logger.info("Database connections closed")
    
    _engine = None
    _async_session_factory = None


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Get async database session.
    This is the main dependency for FastAPI endpoints.
    """
    if not _async_session_factory:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    
    async with _async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context():
    """Context manager for database operations outside of FastAPI."""
    async with get_session() as session:
        yield session


async def check_database_health() -> dict:
    """Check database health and return status."""
    try:
        async with get_db_context() as session:
            # Simple query to check connection
            result = await session.execute("SELECT 1")
            result.scalar()
        
        # Get pool status if available
        pool_status = {}
        if _engine and hasattr(_engine.pool, "status"):
            pool_status = {
                "size": _engine.pool.size(),
                "checked_in": _engine.pool.checkedin(),
                "checked_out": _engine.pool.checkedout(),
                "overflow": _engine.pool.overflow(),
                "total": _engine.pool.total(),
            }
        
        return {
            "status": "healthy",
            "connected": True,
            "pool_status": pool_status,
        }
    except Exception as e:
        logger.error("Database health check failed", error=str(e))
        return {
            "status": "unhealthy",
            "connected": False,
            "error": str(e),
        }


async def check_and_run_migrations() -> None:
    """Check if migrations are needed and run them."""
    # This is a placeholder for Alembic integration
    # In a real implementation, this would check the alembic version
    # and run any pending migrations
    logger.info("Checking for database migrations")
    
    try:
        # Import Alembic config
        from alembic import command
        from alembic.config import Config
        
        # Run migrations
        alembic_cfg = Config("alembic.ini")
        # command.upgrade(alembic_cfg, "head")
        
        logger.info("Database migrations completed")
    except ImportError:
        logger.debug("Alembic not installed, skipping migrations")
    except Exception as e:
        logger.error("Failed to run migrations", error=str(e))


# Query logging for development
if settings.is_development:
    @event.listens_for(Engine, "before_execute")
    def log_query(conn, clauseelement, multiparams, params, execution_options):
        """Log SQL queries in development mode."""
        logger.debug(
            "SQL Query",
            query=str(clauseelement)[:200],
            params=str(params)[:100] if params else None,
        )


# Connection pool events for monitoring
@event.listens_for(Engine, "connect")
def receive_connect(dbapi_connection, connection_record):
    """Log new database connections."""
    logger.debug("New database connection established")


@event.listens_for(Engine, "checkout")
def receive_checkout(dbapi_connection, connection_record, connection_proxy):
    """Log connection checkouts from pool."""
    logger.debug("Connection checked out from pool")


@event.listens_for(Engine, "checkin")
def receive_checkin(dbapi_connection, connection_record):
    """Log connection returns to pool."""
    logger.debug("Connection returned to pool")


class DatabaseManager:
    """Manager class for database operations and maintenance."""
    
    @staticmethod
    async def vacuum_database() -> None:
        """Run VACUUM on SQLite database to reclaim space."""
        if "sqlite" in settings.DATABASE_URL:
            try:
                async with _engine.begin() as conn:
                    await conn.execute("VACUUM")
                logger.info("Database VACUUM completed")
            except Exception as e:
                logger.error("Failed to VACUUM database", error=str(e))
    
    @staticmethod
    async def analyze_database() -> None:
        """Run ANALYZE to update SQLite statistics."""
        if "sqlite" in settings.DATABASE_URL:
            try:
                async with _engine.begin() as conn:
                    await conn.execute("ANALYZE")
                logger.info("Database ANALYZE completed")
            except Exception as e:
                logger.error("Failed to ANALYZE database", error=str(e))
    
    @staticmethod
    async def get_table_sizes() -> dict:
        """Get size information for all tables."""
        sizes = {}
        
        try:
            async with get_db_context() as session:
                if "sqlite" in settings.DATABASE_URL:
                    # SQLite specific query
                    result = await session.execute(
                        "SELECT name, SUM(pgsize) as size FROM dbstat GROUP BY name"
                    )
                    for row in result:
                        sizes[row.name] = row.size
                else:
                    # Generic approach - count rows
                    inspector = inspect(_engine)
                    for table_name in inspector.get_table_names():
                        result = await session.execute(
                            f"SELECT COUNT(*) FROM {table_name}"
                        )
                        count = result.scalar()
                        sizes[table_name] = {"rows": count}
        
        except Exception as e:
            logger.error("Failed to get table sizes", error=str(e))
        
        return sizes
    
    @staticmethod
    async def optimize_database() -> None:
        """Run optimization tasks on the database."""
        logger.info("Starting database optimization")
        
        try:
            # Run VACUUM to reclaim space
            await DatabaseManager.vacuum_database()
            
            # Update statistics
            await DatabaseManager.analyze_database()
            
            # Log table sizes
            sizes = await DatabaseManager.get_table_sizes()
            logger.info("Database optimization completed", table_sizes=sizes)
            
        except Exception as e:
            logger.error("Database optimization failed", error=str(e))


# Export commonly used items
__all__ = [
    "Base",
    "get_session",
    "get_db_context",
    "init_db",
    "close_db",
    "check_database_health",
    "DatabaseManager",
]