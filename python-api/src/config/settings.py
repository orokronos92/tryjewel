"""
Flask configuration settings for Bijoux AI Tracking API
"""
from typing import Dict, Any
import os


class Config:
    """Base configuration class"""

    # Flask settings
    SECRET_KEY: str = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG: bool = False
    TESTING: bool = False

    # CORS settings
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

    # Redis settings
    REDIS_URL: str = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    REDIS_CACHE_TTL: int = 100  # milliseconds

    # MediaPipe settings
    MEDIAPIPE_MODEL_COMPLEXITY: int = 1
    MEDIAPIPE_MIN_DETECTION_CONFIDENCE: float = 0.7
    MEDIAPIPE_MIN_TRACKING_CONFIDENCE: float = 0.7

    # API settings
    MAX_CONTENT_LENGTH: int = 16 * 1024 * 1024  # 16MB max image size
    JSON_SORT_KEYS: bool = False

    @classmethod
    def to_dict(cls) -> Dict[str, Any]:
        """Convert config to dictionary"""
        return {
            key: value
            for key, value in cls.__dict__.items()
            if not key.startswith('_') and not callable(value)
        }


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False


class TestingConfig(Config):
    """Testing configuration"""
    DEBUG = True
    TESTING = True
    REDIS_URL = 'redis://localhost:6379/1'  # Use different DB for tests


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False

    @classmethod
    def init_app(cls, app):
        """Initialize production-specific settings"""
        # Ensure SECRET_KEY is set in production
        if not os.getenv('SECRET_KEY'):
            raise ValueError("SECRET_KEY must be set in production environment")


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
