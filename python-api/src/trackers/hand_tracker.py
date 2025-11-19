"""
Hand tracking implementation using MediaPipe

This module provides hand detection and landmark extraction for jewelry placement.
"""
import numpy as np
import mediapipe as mp
from typing import Dict, List, Optional, Tuple, Any
from collections import deque

from .base_tracker import BaseTracker
from utils.performance import track_performance
from config.mediapipe_config import (
    HAND_TRACKING_CONFIG,
    FINGER_LANDMARKS,
    SMOOTHING_CONFIG,
    POSITION_OFFSETS
)
from loguru import logger


class HandTracker(BaseTracker):
    """Hand tracker implementation using MediaPipe Hands"""

    def __init__(self, config: Optional[Dict] = None):
        """
        Initialize HandTracker

        Args:
            config: Optional configuration dictionary
        """
        super().__init__(config or {})
        self.mp_hands = None
        self.hands = None
        self.landmark_history = deque(maxlen=SMOOTHING_CONFIG['window_size'])

    def initialize(self):
        """Initialize MediaPipe Hands model"""
        try:
            logger.info("Initializing MediaPipe Hands...")

            self.mp_hands = mp.solutions.hands

            # Get configuration with defaults
            mp_config = HAND_TRACKING_CONFIG.copy()
            if self.config:
                mp_config.update(self.config)

            self.hands = self.mp_hands.Hands(
                static_image_mode=mp_config['static_image_mode'],
                max_num_hands=mp_config['max_num_hands'],
                model_complexity=mp_config['model_complexity'],
                min_detection_confidence=mp_config['min_detection_confidence'],
                min_tracking_confidence=mp_config['min_tracking_confidence']
            )

            self.is_initialized = True
            logger.info("MediaPipe Hands initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize MediaPipe Hands: {e}")
            self.is_initialized = False
            raise

    @track_performance
    def process_frame(
        self,
        frame: np.ndarray,
        jewelry_type: str = 'ring',
        finger: Optional[str] = 'index',
        hand: Optional[str] = 'right'
    ) -> Dict[str, Any]:
        """
        Process frame and return jewelry position

        Args:
            frame: Input image as numpy array (BGR format)
            jewelry_type: Type of jewelry ('ring', 'bracelet', etc.)
            finger: Selected finger for ring placement
            hand: Selected hand ('left' or 'right')

        Returns:
            Dictionary with tracking results
        """
        if not self.is_initialized:
            raise RuntimeError("HandTracker not initialized. Call initialize() first.")

        if frame is None or frame.size == 0:
            return self._create_error_result("Invalid or empty frame")

        try:
            # Convert BGR to RGB
            rgb_frame = self._convert_to_rgb(frame)

            # Process frame with MediaPipe
            results = self.hands.process(rgb_frame)

            if not results.multi_hand_landmarks:
                return self._create_error_result("No hands detected in frame")

            # Find the correct hand based on selection
            target_hand_landmarks = self._find_target_hand(
                results, hand
            )

            if target_hand_landmarks is None:
                return self._create_error_result(
                    f"{hand.capitalize()} hand not detected"
                )

            # Extract 3D landmarks
            landmarks_3d = self._extract_landmarks_3d(target_hand_landmarks)

            # Store in history for smoothing
            self.landmark_history.append(landmarks_3d)

            # Apply smoothing if enabled
            if SMOOTHING_CONFIG['enable_smoothing'] and len(self.landmark_history) > 1:
                landmarks_3d = self._apply_smoothing()

            # Calculate jewelry position
            if jewelry_type == 'ring':
                jewelry_position = self._calculate_ring_position(
                    landmarks_3d, finger
                )
            elif jewelry_type == 'bracelet':
                jewelry_position = self._calculate_bracelet_position(
                    landmarks_3d
                )
            else:
                return self._create_error_result(
                    f"Unsupported jewelry type: {jewelry_type}"
                )

            # Create hand result
            hand_result = self._create_hand_result(
                landmarks_3d, hand, 0.9  # Confidence placeholder
            )

            return {
                'success': True,
                'jewelry_type': jewelry_type,
                'jewelry_position': jewelry_position,
                'hand_result': hand_result,
                'confidence': jewelry_position['confidence'],
                'error': None
            }

        except Exception as e:
            logger.error(f"Error processing frame: {e}")
            return self._create_error_result(f"Processing error: {str(e)}")

    def _convert_to_rgb(self, frame: np.ndarray) -> np.ndarray:
        """Convert BGR frame to RGB"""
        return np.flip(frame, axis=2)

    def _find_target_hand(
        self,
        results: Any,
        target_hand: str
    ) -> Optional[Any]:
        """
        Find the target hand (left/right) in MediaPipe results

        Args:
            results: MediaPipe hands results
            target_hand: 'left' or 'right'

        Returns:
            Landmarks for the target hand or None
        """
        if not results.multi_handedness:
            return None

        for idx, handedness in enumerate(results.multi_handedness):
            # MediaPipe uses: 0 = Right, 1 = Left
            mp_label = handedness.classification[0].label  # "Left" or "Right"
            mp_score = handedness.classification[0].score

            # Convert target to MediaPipe format
            if target_hand.lower() == 'right' and mp_label == 'Right':
                return results.multi_hand_landmarks[idx]
            elif target_hand.lower() == 'left' and mp_label == 'Left':
                return results.multi_hand_landmarks[idx]

        # If target hand not found, return first hand
        if results.multi_hand_landmarks:
            logger.warning(
                f"Target hand ({target_hand}) not found, using first detected hand"
            )
            return results.multi_hand_landmarks[0]

        return None

    def _extract_landmarks_3d(self, hand_landmarks: Any) -> List[Dict[str, float]]:
        """
        Extract 3D landmarks from MediaPipe hand landmarks

        Args:
            hand_landmarks: MediaPipe hand landmarks

        Returns:
            List of 3D landmark dictionaries
        """
        landmarks_3d = []

        for landmark in hand_landmarks.landmark:
            landmarks_3d.append({
                'x': landmark.x,
                'y': landmark.y,
                'z': landmark.z,
                'visibility': getattr(landmark, 'visibility', 0.0),
                'presence': getattr(landmark, 'presence', 0.0)
            })

        return landmarks_3d

    def _apply_smoothing(self) -> List[Dict[str, float]]:
        """
        Apply moving average smoothing to landmark history

        Returns:
            Smoothed 3D landmarks
        """
        if not self.landmark_history:
            return []

        window_size = len(self.landmark_history)
        num_landmarks = len(self.landmark_history[0])

        smoothed = []

        for i in range(num_landmarks):
            # Average x, y, z coordinates
            avg_x = sum(frame[i]['x'] for frame in self.landmark_history) / window_size
            avg_y = sum(frame[i]['y'] for frame in self.landmark_history) / window_size
            avg_z = sum(frame[i]['z'] for frame in self.landmark_history) / window_size

            avg_visibility = sum(
                frame[i].get('visibility', 0.0) for frame in self.landmark_history
            ) / window_size

            smoothed.append({
                'x': avg_x,
                'y': avg_y,
                'z': avg_z,
                'visibility': avg_visibility
            })

        return smoothed

    def _calculate_ring_position(
        self,
        landmarks: List[Dict[str, float]],
        finger: str
    ) -> Dict[str, Any]:
        """
        Calculate ring position and orientation for a finger

        Args:
            landmarks: 3D landmarks list
            finger: Finger name ('thumb', 'index', 'middle', 'ring', 'pinky')

        Returns:
            Dictionary with position, rotation, scale, and confidence
        """
        finger_landmarks = FINGER_LANDMARKS[finger]

        # Get tip and base positions
        tip_idx = finger_landmarks['tip']
        base_idx = finger_landmarks['mcp']

        tip_pos = landmarks[tip_idx]
        base_pos = landmarks[base_idx]

        # Calculate finger direction vector
        direction = {
            'x': tip_pos['x'] - base_pos['x'],
            'y': tip_pos['y'] - base_pos['y'],
            'z': tip_pos['z'] - base_pos['z']
        }

        # Normalize direction
        length = np.sqrt(direction['x']**2 + direction['y']**2 + direction['z']**2)
        if length > 0:
            direction = {k: v / length for k, v in direction.items()}

        # Position (middle of finger segment)
        position = {
            'x': (tip_pos['x'] + base_pos['x']) / 2,
            'y': (tip_pos['y'] + base_pos['y']) / 2,
            'z': (tip_pos['z'] + base_pos['z']) / 2 + POSITION_OFFSETS['ring']['depth_offset']
        }

        # Rotation (pointing down the finger)
        rotation = self._calculate_rotation_from_direction(direction)

        # Scale based on finger length
        scale = max(0.5, min(1.5, length * 2))  # Normalize and clamp

        # Confidence based on visibility
        visibility = (tip_pos.get('visibility', 0.0) + base_pos.get('visibility', 0.0)) / 2
        confidence = visibility

        return {
            'position': position,
            'rotation': rotation,
            'scale': scale,
            'confidence': confidence
        }

    def _calculate_bracelet_position(
        self,
        landmarks: List[Dict[str, float]]
    ) -> Dict[str, Any]:
        """
        Calculate bracelet position on wrist

        Args:
            landmarks: 3D landmarks list

        Returns:
            Dictionary with position, rotation, scale, and confidence
        """
        # Wrist is landmark 0
        wrist_pos = landmarks[0]

        # Position (slightly offset from wrist surface)
        position = {
            'x': wrist_pos['x'],
            'y': wrist_pos['y'],
            'z': wrist_pos['z'] + POSITION_OFFSETS['bracelet']['depth_offset']
        }

        # Calculate rotation from forearm direction (landmarks 0 -> 5 -> 9)
        if len(landmarks) > 9:
            pos_5 = landmarks[5]
            direction = {
                'x': pos_5['x'] - wrist_pos['x'],
                'y': pos_5['y'] - wrist_pos['y'],
                'z': pos_5['z'] - wrist_pos['z']
            }
            rotation = self._calculate_rotation_from_direction(direction)
        else:
            # Default rotation if not enough landmarks
            rotation = {'x': 0, 'y': 0, 'z': 0}

        # Scale based on wrist size (distance between landmarks)
        scale = 1.0  # Default scale

        # Confidence based on visibility
        confidence = wrist_pos.get('visibility', 0.0)

        return {
            'position': position,
            'rotation': rotation,
            'scale': scale,
            'confidence': confidence
        }

    def _calculate_rotation_from_direction(
        self,
        direction: Dict[str, float]
    ) -> Dict[str, float]:
        """
        Calculate rotation angles from direction vector

        Args:
            direction: 3D direction vector

        Returns:
            Rotation in degrees (x, y, z)
        """
        # Convert to numpy array
        dx, dy, dz = direction['x'], direction['y'], direction['z']

        # Calculate pitch (x-axis rotation)
        pitch = np.arctan2(dy, np.sqrt(dx**2 + dz**2)) * 180 / np.pi

        # Calculate yaw (y-axis rotation)
        yaw = np.arctan2(dx, dz) * 180 / np.pi

        # Calculate roll (z-axis rotation) - simplified
        roll = 0.0

        return {
            'x': float(pitch),
            'y': float(yaw),
            'z': float(roll)
        }

    def _create_hand_result(
        self,
        landmarks: List[Dict[str, float]],
        hand: str,
        confidence: float
    ) -> Dict[str, Any]:
        """
        Create hand result dictionary

        Args:
            landmarks: 3D landmarks
            hand: Hand side ('left' or 'right')
            confidence: Confidence score

        Returns:
            Hand result dictionary
        """
        return {
            'handedness': hand.capitalize(),
            'handedness_score': confidence,
            'landmarks': landmarks
        }

    def _create_error_result(self, error_message: str) -> Dict[str, Any]:
        """Create error result dictionary"""
        return {
            'success': False,
            'jewelry_type': None,
            'jewelry_position': None,
            'hand_result': None,
            'confidence': 0.0,
            'error': error_message
        }

    def close(self):
        """Cleanup resources"""
        if self.hands:
            try:
                self.hands.close()
                logger.info("MediaPipe Hands resources cleaned up")
            except Exception as e:
                logger.error(f"Error closing MediaPipe Hands: {e}")

        self.is_initialized = False
