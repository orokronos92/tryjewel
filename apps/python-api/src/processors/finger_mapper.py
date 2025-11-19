"""Finger mapping utilities

This module maps user finger selection to MediaPipe landmark indices.
"""
from typing import Dict
from config.mediapipe_config import FINGER_LANDMARKS


class FingerMapper:
    """Maps user finger selection to MediaPipe landmarks"""

    @staticmethod
    def get_ring_landmarks(finger: str, hand: str) -> Dict[str, int]:
        """
        Returns landmark indices for ring placement

        Args:
            finger: 'thumb', 'index', 'middle', 'ring', 'pinky'
            hand: 'left', 'right'

        Returns:
            Dict with 'tip', 'base', 'mid' landmark indices

        Raises:
            ValueError: If finger or hand is invalid
        """
        valid_fingers = ['thumb', 'index', 'middle', 'ring', 'pinky']
        valid_hands = ['left', 'right']

        if finger not in valid_fingers:
            raise ValueError(f"Invalid finger: {finger}. Must be one of {valid_fingers}")

        if hand not in valid_hands:
            raise ValueError(f"Invalid hand: {hand}. Must be one of {valid_hands}")

        # Get landmarks for the finger
        finger_landmarks = FINGER_LANDMARKS[finger]

        # Return simplified mapping for ring placement
        result = {
            'tip': finger_landmarks['tip'],
            'base': finger_landmarks['mcp']
        }

        # Add mid point (pip for fingers, ip for thumb)
        if finger == 'thumb':
            result['mid'] = finger_landmarks.get('ip', finger_landmarks['mcp'])
        else:
            result['mid'] = finger_landmarks.get('pip', finger_landmarks['mcp'])

        # Note: Hand (left/right) is mainly for selection
        # MediaPipe detects handedness automatically
        # The landmark indices are the same for both hands

        return result

    @staticmethod
    def get_bracelet_landmarks(hand: str) -> Dict[str, int]:
        """
        Returns landmark indices for bracelet placement on wrist

        Args:
            hand: 'left', 'right'

        Returns:
            Dict with wrist landmark index and related indices
        """
        valid_hands = ['left', 'right']

        if hand not in valid_hands:
            raise ValueError(f"Invalid hand: {hand}. Must be one of {valid_hands}")

        # Wrist landmark is index 0 for both hands
        return {
            'wrist': 0,
            'hand': hand
        }

    @staticmethod
    def get_all_finger_mappings() -> Dict[str, Dict[str, int]]:
        """
        Returns all finger landmark mappings

        Returns:
            Dictionary mapping finger names to landmark indices
        """
        return FINGER_LANDMARKS

    @staticmethod
    def validate_selection(jewelry_type: str, finger: str = None, hand: str = None) -> bool:
        """
        Validates finger and hand selection based on jewelry type

        Args:
            jewelry_type: Type of jewelry ('ring', 'bracelet', etc.)
            finger: Selected finger (for rings)
            hand: Selected hand

        Returns:
            True if selection is valid

        Raises:
            ValueError: If selection is invalid
        """
        valid_jewelry_types = ['ring', 'bracelet', 'earring', 'necklace']
        valid_fingers = ['thumb', 'index', 'middle', 'ring', 'pinky']
        valid_hands = ['left', 'right']

        if jewelry_type not in valid_jewelry_types:
            raise ValueError(f"Invalid jewelry_type: {jewelry_type}")

        if jewelry_type == 'ring':
            if finger is None:
                raise ValueError("Finger is required for ring jewelry type")
            if finger not in valid_fingers:
                raise ValueError(f"Invalid finger: {finger}")

        if hand is not None and hand not in valid_hands:
            raise ValueError(f"Invalid hand: {hand}")

        return True
