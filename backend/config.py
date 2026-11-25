"""Environment-driven configuration for ConnectMeet.

Every secret lives in the environment (never in source). `.env.example`
documents the required variables with placeholders only.
"""

import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class BaseConfig:
    """Shared configuration for every environment."""

    # Development defaults — MUST be overridden in production (see
    # ProductionConfig.init_check() which warns when they are not).
    SECRET_KEY = os.getenv("SECRET_KEY", "connectmeet-dev-secret-change-me-0123456789abcdef")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_HOURS", "12")))
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"

    # ---------------------------------------------------------------- database
    # Local default uses the dedicated `connectmeet` MySQL user created by
    # database/init_db.sql. Production supplies a full DATABASE_URL.
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://connectmeet:connectmeet_pass@localhost:3306/connectmeet_db",
    )
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Pool tuning only applies to MySQL — SQLite's pool rejects these options.
    SQLALCHEMY_ENGINE_OPTIONS = (
        {
            "pool_pre_ping": True,
            "pool_recycle": 280,
            "pool_timeout": 10,
            # Cheap hosts cap concurrent connections (Clever Cloud DEV = 5),
            # so pool sizes are tunable per environment.
            "pool_size": int(os.getenv("DB_POOL_SIZE", "5")),
            "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "5")),
        }
        if DATABASE_URL.startswith(("mysql", "mariadb"))
        else {}
    )

    # ------------------------------------------------------------------- cors
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # ------------------------------------------------------------------ agora
    AGORA_APP_ID = os.getenv("AGORA_APP_ID", "")
    AGORA_APP_CERTIFICATE = os.getenv("AGORA_APP_CERTIFICATE", "")
    AGORA_RTC_TOKEN_TTL = int(os.getenv("AGORA_RTC_TOKEN_TTL", "3600"))
    AGORA_RTM_TOKEN_TTL = int(os.getenv("AGORA_RTM_TOKEN_TTL", "3600"))

    # ----------------------------------------------------------- misc
    MEETING_CODE_ALPHABET = os.getenv("MEETING_CODE_ALPHABET", "ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
    MEETING_CODE_LENGTH = int(os.getenv("MEETING_CODE_LENGTH", "10"))
    RATE_LIMIT_ENABLED = _bool("RATE_LIMIT_ENABLED", True)
    JSON_SORT_KEYS = False


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    ENV = "development"


class TestingConfig(BaseConfig):
    TESTING = True
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")


class ProductionConfig(BaseConfig):
    DEBUG = False
    ENV = "production"

    @classmethod
    def init_check(cls) -> list[str]:
        """Return a list of misconfiguration warnings for the operator."""
        warnings = []
        if cls.SECRET_KEY in {"", "connectmeet-dev-secret-change-me-0123456789abcdef"}:
            warnings.append("SECRET_KEY is not set — using an insecure development default.")
        if cls.JWT_SECRET_KEY == cls.SECRET_KEY and not os.getenv("JWT_SECRET_KEY"):
            warnings.append("JWT_SECRET_KEY is not set separately from SECRET_KEY.")
        if not cls.AGORA_APP_ID:
            warnings.append("AGORA_APP_ID is not set — video calls will not start.")
        if not cls.AGORA_APP_CERTIFICATE:
            warnings.append("AGORA_APP_CERTIFICATE is not set — token generation is disabled.")
        return warnings


CONFIGS = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(name: str | None = None):
    name = (name or os.getenv("FLASK_ENV", "development")).lower()
    return CONFIGS.get(name, DevelopmentConfig)
