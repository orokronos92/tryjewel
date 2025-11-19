"""
MediaPipe configuration constants for Bijoux AI

This module contains optimized parameters for MediaPipe models
"""
from typing import Dict, Any

# MediaPipe Hands Model Configuration
HAND_TRACKING_CONFIG = {
    'static_image_mode': False,              # Video stream mode (not static images)
    'max_num_hands': 2,                      # Maximum hands to detect
    'model_complexity': 1,                   # 0=lite, 1=full (default), 2=heavy
    'min_detection_confidence': 0.7,        # Minimum confidence for detection
    'min_tracking_confidence': 0.7          # Minimum confidence for tracking
}

# Finger landmark mappings for ring placement
FINGER_LANDMARKS = {
    'thumb': {
        'tip': 4,
        'ip': 3,    # Interphalangeal joint
        'mcp': 2    # Metacarpophalangeal joint
    },
    'index': {
        'tip': 8,
        'dip': 7,   # Distal interphalangeal joint
        'pip': 6,   # Proximal interphalangeal joint
        'mcp': 5
    },
    'middle': {
        'tip': 12,
        'dip': 11,
        'pip': 10,
        'mcp': 9
    },
    'ring': {
        'tip': 16,
        'dip': 15,
        'pip': 14,
        'mcp': 13
    },
    'pinky': {
        'tip': 20,
        'dip': 19,
        'pip': 18,
        'mcp': 17
    }
}

# Handedness mapping (MediaPipe returns 0=Right, 1=Left)
HANDEDNESS_MAP = {
    0: 'Right',
    1: 'Left'
}

# Jewelry position offset constants (in normalized coordinates)
POSITION_OFFSETS = {
    'ring': {
        'depth_offset': 0.02,  # Offset from finger surface
        'width_scale': 0.8     # Ring width relative to finger width
    },
    'bracelet': {
        'depth_offset': 0.03,  # Offset from wrist surface
        'radius_scale': 1.2    # Bracelet radius relative to wrist
    }
}

# Smoothing parameters
SMOOTHING_CONFIG = {
    'window_size': 5,              # Moving average window size
    'enable_smoothing': True       # Enable/disable smoothing
}

# Confidence thresholds
CONFIDENCE_THRESHOLDS = {
    'min_landmark_confidence': 0.6,      # Minimum landmark confidence to use
    'min_jewelry_placement_confidence': 0.7  # Minimum confidence for jewelry placement
}


def get_hand_tracking_config() -> Dict[str, Any]:
    """Get MediaPipe Hands tracking configuration"""
    return HAND_TRACKING_CONFIG.copy()


def get_finger_landmarks(finger: str) -> Dict[str, int]:
    """Get landmark indices for a specific finger

    Args:
        finger: Finger name ('thumb', 'index', 'middle', 'ring', 'pinky')

    Returns:
        Dictionary with landmark indices

    Raises:
        KeyError: If finger name is invalid
    """
    return FINGER_LANDMARKS[finger].copy()


def get_all_finger_landmarks() -> Dict[str, Dict[str, int]]:
    """Get all finger landmark mappings"""
    return FINGER_LANDMARKS.copy()


def get_smoothing_config() -> Dict[str, Any]:
    """Get smoothing configuration"""
    return SMOOTHING_CONFIG.copy()
