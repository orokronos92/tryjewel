"""Pydantic validation schemas for API requests

This module contains validation schemas for API request validation
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
import base64
import binascii


class ImageSchema(BaseModel):
    """Schema for image data in request"""
    image_data: str = Field(..., description="Base64 encoded image data")
    format: Optional[str] = Field(None, description="Image format (jpeg, png, etc.)")
    width: Optional[int] = Field(None, description="Image width in pixels")
    height: Optional[int] = Field(None, description="Image height in pixels")

    @validator('image_data')
    def validate_base64(cls, v):
        """Validate that image_data is valid base64"""
        try:
            # Try to decode base64
            base64.b64decode(v, validate=True)
            return v
        except binascii.Error as e:
            raise ValueError(f"Invalid base64 encoding: {e}")
        except Exception as e:
            raise ValueError(f"Invalid image data: {e}")

    class Config:
        """Pydantic config"""
        schema_extra = {
            "example": {
                "image_data": "/9j/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS...",
                "format": "jpeg",
                "width": 640,
                "height": 480
            }
        }


class TrackingRequestSchema(BaseModel):
    """Schema for tracking API requests"""
    image: ImageSchema
    jewelry_type: str = Field(..., description="Type of jewelry: 'ring', 'bracelet', 'earring', 'necklace'")
    finger: Optional[str] = Field(None, description="Selected finger for rings: thumb, index, middle, ring, pinky")
    hand: Optional[str] = Field(None, description="Selected hand: left or right")
    request_id: Optional[str] = Field(None, description="Optional request ID for tracking")
    enable_caching: bool = Field(True, description="Enable Redis caching")

    @validator('jewelry_type')
    def validate_jewelry_type(cls, v):
        """Validate jewelry type"""
        valid_types = ['ring', 'bracelet', 'earring', 'necklace']
        if v not in valid_types:
            raise ValueError(f"Invalid jewelry_type. Must be one of: {', '.join(valid_types)}")
        return v

    @validator('finger')
    def validate_finger(cls, v):
        """Validate finger selection"""
        if v is None:
            return v
        valid_fingers = ['thumb', 'index', 'middle', 'ring', 'pinky']
        if v not in valid_fingers:
            raise ValueError(f"Invalid finger. Must be one of: {', '.join(valid_fingers)}")
        return v

    @validator('hand')
    def validate_hand(cls, v):
        """Validate hand selection"""
        if v is None:
            return v
        valid_hands = ['left', 'right']
        if v not in valid_hands:
            raise ValueError(f"Invalid hand. Must be one of: {', '.join(valid_hands)}")
        return v

    class Config:
        """Pydantic config"""
        schema_extra = {
            "example": {
                "image": {
                    "image_data": "/9j/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS...",
                    "format": "jpeg",
                    "width": 640,
                    "height": 480
                },
                "jewelry_type": "ring",
                "finger": "index",
                "hand": "right",
                "request_id": "req_12345",
                "enable_caching": True
            }
        }


class WebSocketTrackingSchema(BaseModel):
    """Schema for WebSocket tracking requests"""
    image_base64: str = Field(..., description="Base64 encoded frame")
    jewelry_type: str = Field(..., description="Type of jewelry")
    finger: Optional[str] = Field(None, description="Selected finger")
    hand: Optional[str] = Field(None, description="Selected hand")
    frame_id: Optional[str] = Field(None, description="Frame ID for tracking")
    timestamp: Optional[float] = Field(None, description="Client timestamp")

    class Config:
        """Pydantic config"""
        schema_extra = {
            "example": {
                "image_base64": "/9j/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS...",
                "jewelry_type": "ring",
                "finger": "index",
                "hand": "right",
                "frame_id": "frame_123",
                "timestamp": 1234567890.123
            }
        }


class HealthCheckSchema(BaseModel):
    """Schema for health check response"""
    status: str = Field(description="Service status")
    service: str = Field(description="Service name")
    version: str = Field(description="API version")
    mediapipe_loaded: bool = Field(description="MediaPipe initialization status")
    timestamp: float = Field(description="Timestamp")

    class Config:
        """Pydantic config"""
        schema_extra = {
            "example": {
                "status": "healthy",
                "service": "Bijoux AI Tracking API",
                "version": "2.0",
                "mediapipe_loaded": True,
                "timestamp": 1234567890.123
            }
        }
