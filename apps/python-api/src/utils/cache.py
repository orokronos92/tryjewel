"""
Redis cache wrapper for tracking landmarks

This module provides a Redis-based caching layer for tracking results
to improve performance and reduce redundant MediaPipe processing.
"""
import json
import time
from typing import Optional, Dict, Any, List
import redis
from loguru import logger


class RedisCache:
    """Redis-based cache for tracking landmarks"""

    def __init__(self, redis_url: str = 'redis://localhost:6379/0', ttl_ms: int = 100):
        """
        Initialize Redis cache connection

        Args:
            redis_url: Redis connection URL
            ttl_ms: Time-to-live in milliseconds for cached entries
        """
        try:
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            # Test connection
            self.redis_client.ping()
            self.ttl_ms = ttl_ms
            logger.info(f"RedisCache initialized at {redis_url} with TTL {ttl_ms}ms")
        except redis.ConnectionError as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.redis_client = None
            self.ttl_ms = ttl_ms
        except Exception as e:
            logger.error(f"Unexpected error initializing Redis: {e}")
            self.redis_client = None
            self.ttl_ms = ttl_ms

    def is_connected(self) -> bool:
        """Check if Redis connection is active"""
        if not self.redis_client:
            return False
        try:
            self.redis_client.ping()
            return True
        except:
            return False

    def generate_key(self, prefix: str, identifier: str) -> str:
        """
        Generate cache key with prefix

        Args:
            prefix: Key prefix (e.g., 'landmarks', 'tracking')
            identifier: Unique identifier (e.g., frame hash, user ID)

        Returns:
            Formatted cache key
        """
        import hashlib

        # Create hash of identifier for consistent key length
        identifier_hash = hashlib.md5(identifier.encode()).hexdigest()[:16]
        return f"bijoux:{prefix}:{identifier_hash}"

    def set_landmarks(self, frame_id: str, landmarks: Dict[str, Any]) -> bool:
        """
        Cache tracking landmarks for a frame

        Args:
            frame_id: Unique frame identifier
            landmarks: Dictionary containing landmark data

        Returns:
            True if cached successfully, False otherwise
        """
        if not self.is_connected():
            logger.debug("Redis not connected, skipping cache set")
            return False

        try:
            key = self.generate_key('landmarks', frame_id)
            value = json.dumps(landmarks)

            # Set with TTL in seconds (convert from ms)
            ttl_seconds = self.ttl_ms / 1000.0
            self.redis_client.setex(key, int(ttl_seconds), value)

            logger.debug(f"Cached landmarks for frame {frame_id[:8]}... (TTL: {self.ttl_ms}ms)")
            return True

        except Exception as e:
            logger.error(f"Failed to cache landmarks: {e}")
            return False

    def get_landmarks(self, frame_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached landmarks for a frame

        Args:
            frame_id: Unique frame identifier

        Returns:
            Dictionary of landmarks if found and valid, None otherwise
        """
        if not self.is_connected():
            logger.debug("Redis not connected, skipping cache get")
            return None

        try:
            key = self.generate_key('landmarks', frame_id)
            value = self.redis_client.get(key)

            if value is None:
                logger.debug(f"Cache miss for frame {frame_id[:8]}...")
                return None

            landmarks = json.loads(value)
            logger.debug(f"Cache hit for frame {frame_id[:8]}...")
            return landmarks

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse cached landmarks JSON: {e}")
            return None
        except Exception as e:
            logger.error(f"Failed to retrieve cached landmarks: {e}")
            return None

    def invalidate_landmarks(self, frame_id: str) -> bool:
        """
        Remove landmarks from cache (useful for testing)

        Args:
            frame_id: Frame identifier to invalidate

        Returns:
            True if deleted or not found, False on error
        """
        if not self.is_connected():
            return False

        try:
            key = self.generate_key('landmarks', frame_id)
            self.redis_client.delete(key)
            logger.debug(f"Invalidated cache for frame {frame_id[:8]}...")
            return True
        except Exception as e:
            logger.error(f"Failed to invalidate cache: {e}")
            return False

    def clear_all_landmarks(self) -> int:
        """
        Clear all landmark entries from cache

        Returns:
            Number of keys deleted
        """
        if not self.is_connected():
            return 0

        try:
            pattern = self.generate_key('landmarks', '*').replace('*', '') + '*'
            keys = list(self.redis_client.scan_iter(match=pattern))

            if keys:
                deleted_count = self.redis_client.delete(*keys)
                logger.info(f"Cleared {deleted_count} landmark entries from cache")
                return deleted_count

            return 0

        except Exception as e:
            logger.error(f"Failed to clear landmarks cache: {e}")
            return 0

    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics

        Returns:
            Dictionary with cache statistics
        """
        if not self.is_connected():
            return {
                'connected': False,
                'status': 'disconnected',
                'ttl_ms': self.ttl_ms
            }

        try:
            info = self.redis_client.info('stats')
            return {
                'connected': True,
                'status': 'connected',
                'ttl_ms': self.ttl_ms,
                'redis_version': info.get('redis_version', 'unknown'),
                'total_commands_processed': info.get('total_commands_processed', 0),
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0),
                'hit_rate': info.get('keyspace_hits', 0) / max(info.get('keyspace_hits', 0) + info.get('keyspace_misses', 0), 1)
            }
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {
                'connected': True,
                'status': 'error',
                'error': str(e)
            }
