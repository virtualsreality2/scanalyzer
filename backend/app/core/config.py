"""
Configuration management for Scanalyzer backend.
Handles environment variables, paths, and application settings.
"""

import os
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
from functools import lru_cache

from pydantic import Field, field_validator, SecretStr
from pydantic_settings import BaseSettings
from pydantic.networks import AnyHttpUrl


class Settings(BaseSettings):
    """Application settings with validation and platform-specific handling."""
    
    # Application
    APP_NAME: str = "Scanalyzer"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = Field(default=False, env="DEBUG")
    ENVIRONMENT: str = Field(default="production", pattern="^(development|staging|production)$")
    
    # API
    API_V1_PREFIX: str = "/api/v1"
    API_TITLE: str = "Scanalyzer API"
    API_DESCRIPTION: str = "Security Report Analysis API"
    
    # Server
    HOST: str = Field(default="127.0.0.1", env="HOST")
    PORT: int = Field(default=8000, env="PORT")
    WORKERS: int = Field(default=1, env="WORKERS")  # Single worker for desktop app
    
    # CORS
    CORS_ORIGINS: List[AnyHttpUrl] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
        ]
    )
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["*"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]
    
    # Paths - Platform specific
    BASE_DIR: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent.parent)
    
    @field_validator("BASE_DIR", mode="before")
    @classmethod
    def validate_base_dir(cls, v):
        """Ensure base directory exists."""
        path = Path(v) if v else Path(__file__).resolve().parent.parent.parent
        if not path.exists():
            path.mkdir(parents=True, exist_ok=True)
        return path
    
    # Storage paths
    @property
    def STORAGE_DIR(self) -> Path:
        """Get platform-specific storage directory."""
        if sys.platform == "win32":
            # Windows: %LOCALAPPDATA%\Scanalyzer
            base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        elif sys.platform == "darwin":
            # macOS: ~/Library/Application Support/Scanalyzer
            base = Path.home() / "Library" / "Application Support"
        else:
            # Linux: ~/.local/share/scanalyzer
            base = Path.home() / ".local" / "share"
        
        storage_dir = base / "Scanalyzer"
        storage_dir.mkdir(parents=True, exist_ok=True)
        return storage_dir
    
    @property
    def DATABASE_DIR(self) -> Path:
        """Database directory path."""
        db_dir = self.STORAGE_DIR / "database"
        db_dir.mkdir(parents=True, exist_ok=True)
        return db_dir
    
    @property
    def REPORTS_DIR(self) -> Path:
        """Reports storage directory."""
        reports_dir = self.STORAGE_DIR / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        return reports_dir
    
    @property
    def TEMP_DIR(self) -> Path:
        """Temporary files directory."""
        temp_dir = self.STORAGE_DIR / "temp"
        temp_dir.mkdir(parents=True, exist_ok=True)
        return temp_dir
    
    @property
    def LOGS_DIR(self) -> Path:
        """Logs directory."""
        logs_dir = self.STORAGE_DIR / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)
        return logs_dir
    
    @property
    def UPLOADS_DIR(self) -> Path:
        """Uploads directory for file storage."""
        uploads_dir = self.STORAGE_DIR / "uploads"
        uploads_dir.mkdir(parents=True, exist_ok=True)
        return uploads_dir
    
    # Database
    DATABASE_NAME: str = Field(default="scanalyzer.db", env="DATABASE_NAME")
    DATABASE_ENCRYPTION_KEY: Optional[SecretStr] = Field(default=None, env="DATABASE_ENCRYPTION_KEY")
    
    @property
    def DATABASE_URL(self) -> str:
        """Get database URL with encryption if key is provided."""
        db_path = self.DATABASE_DIR / self.DATABASE_NAME
        if self.DATABASE_ENCRYPTION_KEY:
            # SQLCipher URL format
            return f"sqlite+pysqlcipher://:{self.DATABASE_ENCRYPTION_KEY.get_secret_value()}@/{db_path}?cipher=aes-256-cfb&kdf_iter=64000"
        else:
            # Regular SQLite URL
            return f"sqlite+aiosqlite:///{db_path}"
    
    # Connection pool settings for desktop app
    DATABASE_POOL_SIZE: int = Field(default=5, ge=1, le=20)
    DATABASE_MAX_OVERFLOW: int = Field(default=10, ge=0, le=20)
    DATABASE_POOL_TIMEOUT: int = Field(default=30, ge=10)
    DATABASE_POOL_RECYCLE: int = Field(default=3600, ge=300)  # Recycle connections after 1 hour
    
    # File handling
    MAX_UPLOAD_SIZE: int = Field(default=500 * 1024 * 1024, env="MAX_UPLOAD_SIZE")  # 500MB
    ALLOWED_EXTENSIONS: List[str] = Field(
        default=[
            ".json", ".xml", ".pdf", ".docx", ".xlsx", ".csv",
            ".html", ".txt", ".log", ".yaml", ".yml"
        ]
    )
    
    # Processing limits
    MAX_CONCURRENT_PARSERS: int = Field(default=3, ge=1, le=10)
    PARSER_TIMEOUT: int = Field(default=300, ge=60)  # 5 minutes
    MAX_FINDINGS_PER_REPORT: int = Field(default=10000, ge=100)
    
    # Memory management
    MEMORY_LIMIT_MB: int = Field(default=1024, ge=256)  # 1GB default limit
    MEMORY_CHECK_INTERVAL: int = Field(default=60, ge=10)  # Check every minute
    
    # Logging
    LOG_LEVEL: str = Field(default="INFO", pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")
    LOG_FORMAT: str = Field(default="json", pattern="^(json|plain)$")
    LOG_MAX_SIZE_MB: int = Field(default=100, ge=10)
    LOG_BACKUP_COUNT: int = Field(default=5, ge=1)
    LOG_INCLUDE_CONTEXT: bool = Field(default=True)
    
    # Security
    SECRET_KEY: SecretStr = Field(..., env="SECRET_KEY")
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)
    
    # Feature flags
    ENABLE_SWAGGER_UI: bool = Field(default=True)
    ENABLE_REDOC: bool = Field(default=True)
    ENABLE_METRICS: bool = Field(default=True)
    ENABLE_TELEMETRY: bool = Field(default=False)
    
    # Parser configurations
    PARSER_CONFIGS: Dict[str, Dict[str, Any]] = Field(
        default={
            "prowler": {
                "enabled": True,
                "versions": ["v2", "v3"],
                "max_file_size_mb": 200,
            },
            "checkov": {
                "enabled": True,
                "max_file_size_mb": 100,
            },
            "bandit": {
                "enabled": True,
                "max_file_size_mb": 50,
            },
            "document": {
                "enabled": True,
                "max_file_size_mb": 50,
                "pdf_extract_images": False,
                "ocr_enabled": False,
            }
        }
    )
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore"
    }
        
    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def validate_secret_key(cls, v):
        """Ensure secret key is set and strong enough."""
        if not v:
            raise ValueError("SECRET_KEY must be set")
        if len(str(v)) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        return v
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS origins from comma-separated string or list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    def get_parser_config(self, parser_name: str) -> Dict[str, Any]:
        """Get configuration for a specific parser."""
        return self.PARSER_CONFIGS.get(parser_name, {})
    
    def is_parser_enabled(self, parser_name: str) -> bool:
        """Check if a parser is enabled."""
        config = self.get_parser_config(parser_name)
        return config.get("enabled", False)
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.ENVIRONMENT == "development" or self.DEBUG
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.ENVIRONMENT == "production" and not self.DEBUG
    
    def get_storage_info(self) -> Dict[str, str]:
        """Get storage paths information."""
        return {
            "storage_dir": str(self.STORAGE_DIR),
            "database_dir": str(self.DATABASE_DIR),
            "reports_dir": str(self.REPORTS_DIR),
            "temp_dir": str(self.TEMP_DIR),
            "logs_dir": str(self.LOGS_DIR),
        }
    
    def cleanup_temp_files(self) -> int:
        """Clean up old temporary files. Returns number of files deleted."""
        import time
        count = 0
        
        # Clean files older than 24 hours
        cutoff_time = time.time() - (24 * 60 * 60)
        
        for file_path in self.TEMP_DIR.glob("*"):
            if file_path.is_file() and file_path.stat().st_mtime < cutoff_time:
                try:
                    file_path.unlink()
                    count += 1
                except Exception:
                    pass  # Ignore errors, file might be in use
        
        return count


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Create a global settings instance
settings = get_settings()