"""Pydantic models for finger and hand selection

This module contains data models for finger selection and hand configuration
"""
from typing import Optional
from pydantic import BaseModel, Field, validator


class Finger(BaseModel):
    """Finger selection model"""
    name: str = Field(..., description="Finger name: thumb, index, middle, ring, pinky")
    landmark_indices: dict = Field(..., description="MediaPipe landmark indices for this finger")

    @validator('name')
    def validate_finger_name(cls, v):
        """Validate finger name"""
        valid_fingers = ['thumb', 'index', 'middle', 'ring', 'pinky']
        if v not in valid_fingers:
            raise ValueError(f"Invalid finger name. Must be one of: {', '.join(valid_fingers)}")
        return v

    class Config:
        """Pydantic config"""
        schema_extra = {
            "example": {
                "name": "index",
                "landmark_indices": {
                    "tip": 8,
                    "dip": 7,
                    "pip": 6,
                    "mcp": 5
                }
            }
        }


class Hand(BaseModel):
    """Hand selection model"""
    side: str = Field(..., description="Hand side: left or right")
    label: str = Field(..., description="MediaPipe label: 'Left' or 'Right'")

    @validator('side')
    def validate_hand_side(cls, v):
        """Validate hand side"""
        valid_hands = ['left', 'right']
        if v not in valid_hands:
            raise ValueError(f"Invalid hand side. Must be one of: {', '.join(valid_hands)}")
        return v

    @validator('label')
    def validate_hand_label(cls, v):
        """Validate hand label"""
        valid_labels = ['Left', 'Right']
        if v not in valid_labels:
            raise ValueError(f"Invalid hand label. Must be one of: {', '.join(valid_labels)}")
        return v

    class Config:
        """Pydantic config"""
        schema_extra = {
            "example": {
                "side": "right",
                "label": "Right"
            }
        }


class FingerSelection(BaseModel):
    """Complete finger and hand selection for jewelry placement"""
    finger: Finger = Field(..., description="Selected finger")
    hand: Hand = Field(..., description="Selected hand")
    jewelry_type: str = Field(..., description="Type of jewelry")

    @validator('jewelry_type')
    def validate_jewelry_type(cls, v):
        """Validate jewelry type"""
        valid_types = ['ring', 'bracelet', 'earring', 'necklace']
        if v not in valid_types:
            raise ValueError(f"Invalid jewelry type. Must be one of: {', '.join(valid_types)}")
        return v

    class Config:
        """Pydantic config"""
        schema_extra = {
            "example": {
                "finger": {
                    "name": "index",
                    "landmark_indices": {
                        "tip": 8,
                        "dip": 7,
                        "pip": 6,
                        "mcp": 5
                    }
                },
                "hand": {
                    "side": "right",
                    "label": "Right"
                },
                "jewelry_type": "ring"
            }
        }


class LandmarkMapping(BaseModel):
    """Mapping between finger/hand and MediaPipe landmark indices"""
    finger_name: str = Field(..., description="Finger name")
    hand_side: str = Field(..., description="Hand side")
    tip_index: int = Field(..., description="Landmark index for finger tip")
    base_index: int = Field(..., description="Landmark index for finger base")
    mid_index: Optional[int] = Field(None, description="Landmark index for finger middle joint")

    class Config:
        """Pydantic config"""
        schema_extra = {
            "example": {
                "finger_name": "index",
                "hand_side": "right",
                "tip_index": 8,
                "base_index": 5,
                "mid_index": 6
            }
        }


class FingerLandmarks(BaseModel):
    """Collection of landmark indices for a finger"""
    tip: int = Field(..., description="Tip landmark index")
    dip: Optional[int] = Field(None, description="Distal interphalangeal joint index")
    pip: Optional[int] = Field(None, description="Proximal interphalangeal joint index")
    mcp: int = Field(..., description="Metacarpophalangeal joint index")

    class Config:
        """Pydantic config"""
        schema_extra = {
            "example": {
                "tip": 8,
                "dip": 7,
                "pip": 6,
                "mcp": 5
            }
        }
