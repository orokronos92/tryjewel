"""Pydantic models for tracking results and API responses

This module contains data models for tracking results, hand data,
and jewelry position information.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class Landmark(BaseModel):
    """3D landmark position with confidence"""
    x: float = Field(description="X coordinate (normalized 0-1)")
    y: float = Field(description="Y coordinate (normalized 0-1)")
    z: float = Field(description="Z coordinate (normalized 0-1)")
    visibility: Optional[float] = Field(None, description="Visibility confidence (0-1)")
    presence: Optional[float] = Field(None, description="Presence confidence (0-1)")


class HandResult(BaseModel):
    """Hand tracking result"""
    handedness: str = Field(description="Hand label: 'Left' or 'Right'")
    handedness_score: float = Field(description="Handedness confidence (0-1)")
    landmarks: List[Landmark] = Field(description="List of 21 hand landmarks")


class JewelryPosition(BaseModel):
    """Jewelry position and orientation data"""
    position: Dict[str, float] = Field(description="3D position coordinates")
    rotation: Dict[str, float] = Field(description="Rotation in degrees (x, y, z)")
    scale: float = Field(description="Scale factor for 3D model")
    confidence: float = Field(description="Confidence score (0-1)")
    finger: Optional[str] = Field(None, description="Selected finger (for rings)")
    hand: Optional[str] = Field(None, description="Selected hand")

    class Config:
        """Pydantic config"""
        schema_extra = {
            "example": {
                "position": {"x": 0.5, "y": 0.3, "z": 0.02},
                "rotation": {"x": 0, "y": 0, "z": 15},
                "scale": 0.8,
                "confidence": 0.92,
                "finger": "index",
                "hand": "right"
            }
        }


class TrackingResult(BaseModel):
    """Complete tracking result for API response"""
    success: bool = Field(description="Tracking success status")
    jewelry_type: str = Field(description="Type of jewelry tracked")
    jewelry_position: Optional[JewelryPosition] = Field(None, description="Jewelry position and orientation")
    hand_result: Optional[HandResult] = Field(None, description="Hand tracking data")
    confidence: float = Field(description="Overall tracking confidence (0-1)")
    processing_time_ms: float = Field(description="Processing time in milliseconds")
    request_id: Optional[str] = Field(None, description="Request ID")
    error: Optional[str] = Field(None, description="Error message if tracking failed")

    class Config:
        """Pydantic config"""
        schema_extra = {
            "example": {
                "success": True,
                "jewelry_type": "ring",
                "jewelry_position": {
                    "position": {"x": 0.5, "y": 0.3, "z": 0.02},
                    "rotation": {"x": 0, "y": 0, "z": 15},
                    "scale": 0.8,
                    "confidence": 0.92,
                    "finger": "index",
                    "hand": "right"
                },
                "hand_result": {
                    "handedness": "Right",
                    "handedness_score": 0.95,
                    "landmarks": [
                        {"x": 0.5, "y": 0.3, "z": 0.0, "visibility": 0.98},
                        # ... 20 more landmarks
                    ]
                },
                "confidence": 0.92,
                "processing_time_ms": 42.5,
                "request_id": "req_12345",
                "error": None
            }
        }


class WebSocketTrackingResult(BaseModel):
    """Tracking result for WebSocket responses"""
    frame_id: str = Field(description="Frame identifier")
    success: bool = Field(description="Tracking success status")
    jewelry_type: str = Field(description="Type of jewelry tracked")
    jewelry_position: Optional[JewelryPosition] = Field(None, description="Jewelry position")
    confidence: float = Field(description="Overall tracking confidence")
    processing_time_ms: float = Field(description="Processing time in milliseconds")
    server_timestamp: float = Field(description="Server processing timestamp")

    class Config:
        """Pydantic config"""
        schema_extra = {
            "example": {
                "frame_id": "frame_123",
                "success": True,
                "jewelry_type": "ring",
                "jewelry_position": {
                    "position": {"x": 0.5, "y": 0.3, "z": 0.02},
                    "rotation": {"x": 0, "y": 0, "z": 15},
                    "scale": 0.8,
                    "confidence": 0.92
                },
                "confidence": 0.92,
                "processing_time_ms": 42.5,
                "server_timestamp": 1234567890.123
            }
        }


class TrackingErrorResult(BaseModel):
    """Error result when tracking fails"""
    success: bool = Field(False, description="Always False for errors")
    error: str = Field(description="Error description")
    error_code: str = Field(description="Error code")
    request_id: Optional[str] = Field(None, description="Request ID")

    class Config:
        """Pydantic config"""
        schema_extra = {
            "example": {
                "success": False,
                "error": "No hand detected in frame",
                "error_code": "NO_HAND_DETECTED",
                "request_id": "req_12345"
            }
        }
