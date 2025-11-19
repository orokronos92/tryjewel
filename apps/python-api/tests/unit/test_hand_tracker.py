"""Unit tests for HandTracker

This module tests the HandTracker class with mocked MediaPipe dependencies.
"""
import pytest
import numpy as np
from unittest.mock import Mock, patch, MagicMock

from src.trackers.hand_tracker import HandTracker


@pytest.fixture
def hand_tracker():
    """Create a HandTracker instance for testing"""
    tracker = HandTracker()
    return tracker


@pytest.fixture
def sample_frame():
    """Create a sample frame for testing"""
    # Create a 640x480 RGB frame
    return np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)


class TestHandTrackerInitialization:
    """Test HandTracker initialization"""

    def test_init(self, hand_tracker):
        """Test that HandTracker initializes correctly"""
        assert not hand_tracker.is_initialized
        assert hand_tracker.config == {}

    def test_initialize(self, hand_tracker):
        """Test that initialize sets up MediaPipe Hands"""
        with patch('mediapipe.solutions.hands.Hands') as mock_hands:
            mock_hands_instance = Mock()
            mock_hands.return_value = mock_hands_instance

            hand_tracker.initialize()

            assert hand_tracker.is_initialized
            assert hand_tracker.hands is not None

    def test_initialize_failure(self, hand_tracker):
        """Test initialization failure handling"""
        with patch('mediapipe.solutions.hands.Hands', side_effect=Exception("MediaPipe error")):
            with pytest.raises(Exception):
                hand_tracker.initialize()

            assert not hand_tracker.is_initialized


class TestHandTrackerProcessFrame:
    """Test frame processing"""

    def test_process_frame_not_initialized(self, hand_tracker, sample_frame):
        """Test error when not initialized"""
        with pytest.raises(RuntimeError, match="not initialized"):
            hand_tracker.process_frame(sample_frame)

    def test_process_frame_invalid_frame(self, hand_tracker):
        """Test error with invalid frame"""
        hand_tracker.initialize = Mock()
        hand_tracker.is_initialized = True

        result = hand_tracker.process_frame(None)
        assert result['success'] is False
        assert 'error' in result

    def test_process_frame_no_hands(self, hand_tracker, sample_frame):
        """Test processing when no hands are detected"""
        hand_tracker.is_initialized = True
        hand_tracker.hands = Mock()
        hand_tracker.hands.process = Mock(return_value=Mock(
            multi_hand_landmarks=None
        ))

        result = hand_tracker.process_frame(sample_frame)

        assert result['success'] is False
        assert 'No hands detected' in result['error']

    def test_convert_to_rgb(self, hand_tracker):
        """Test BGR to RGB conversion"""
        # Create a BGR frame (OpenCV format)
        bgr_frame = np.array([
            [[255, 0, 0], [255, 0, 0]],  # Blue pixel
            [[0, 255, 0], [0, 255, 0]]   # Green pixel
        ], dtype=np.uint8)

        rgb_frame = hand_tracker._convert_to_rgb(bgr_frame)

        # Check that colors are flipped
        assert rgb_frame[0, 0, 0] == 0   # R channel = 0 (was B)
        assert rgb_frame[0, 0, 2] == 255 # B channel = 255 (was R)


class TestHandTrackerExtractLandmarks:
    """Test landmark extraction"""

    def test_extract_landmarks_3d(self, hand_tracker):
        """Test 3D landmark extraction from MediaPipe format"""
        # Create mock hand landmarks
        mock_landmark = Mock()
        mock_landmark.x = 0.5
        mock_landmark.y = 0.3
        mock_landmark.z = 0.1
        mock_landmark.visibility = 0.9

        mock_hand_landmarks = Mock()
        mock_hand_landmarks.landmark = [mock_landmark] * 21

        landmarks = hand_tracker._extract_landmarks_3d(mock_hand_landmarks)

        assert len(landmarks) == 21
        assert landmarks[0]['x'] == 0.5
        assert landmarks[0]['y'] == 0.3
        assert landmarks[0]['z'] == 0.1
        assert landmarks[0]['visibility'] == 0.9


class TestHandTrackerCalculateRingPosition:
    """Test ring position calculation"""

    def test_calculate_ring_position_index_finger(self, hand_tracker):
        """Test ring position for index finger"""
        # Create mock landmarks
        landmarks = [
            {'x': 0.0, 'y': 0.0, 'z': 0.0, 'visibility': 1.0}  # Wrist
        ]
        for _ in range(20):
            landmarks.append({
                'x': 0.5,
                'y': 0.5,
                'z': 0.1,
                'visibility': 0.9
            })

        result = hand_tracker._calculate_ring_position(landmarks, 'index')

        assert 'position' in result
        assert 'rotation' in result
        assert 'scale' in result
        assert 'confidence' in result

        # Check confidence is based on visibility
        assert 0.0 <= result['confidence'] <= 1.0

    def test_calculate_ring_position_thumb(self, hand_tracker):
        """Test ring position for thumb (different landmark structure)"""
        landmarks = [
            {'x': 0.0, 'y': 0.0, 'z': 0.0, 'visibility': 1.0}
        ]
        for _ in range(20):
            landmarks.append({
                'x': 0.6,
                'y': 0.4,
                'z': 0.2,
                'visibility': 0.8
            })

        result = hand_tracker._calculate_ring_position(landmarks, 'thumb')

        assert result['success'] is not False  # Check no error
        assert 'position' in result


class TestHandTrackerCalculateBraceletPosition:
    """Test bracelet position calculation"""

    def test_calculate_bracelet_position(self, hand_tracker):
        """Test bracelet position calculation"""
        landmarks = [
            {'x': 0.5, 'y': 0.6, 'z': 0.0, 'visibility': 0.95}
        ]
        for _ in range(20):
            landmarks.append({'x': 0.5, 'y': 0.5, 'z': 0.1, 'visibility': 0.9})

        result = hand_tracker._calculate_bracelet_position(landmarks)

        assert 'position' in result
        assert 'rotation' in result
        assert 'scale' in result
        assert 'confidence' in result

        # Check position has depth offset
        assert result['position']['z'] > 0


class TestHandTrackerCalculateRotation:
    """Test rotation calculation"""

    def test_calculate_rotation_from_direction(self, hand_tracker):
        """Test 3D rotation calculation from direction vector"""
        # Straight direction
        direction = {'x': 0, 'y': 0, 'z': 1}
        rotation = hand_tracker._calculate_rotation_from_direction(direction)

        assert 'x' in rotation
        assert 'y' in rotation
        assert 'z' in rotation
        assert isinstance(rotation['x'], float)
        assert isinstance(rotation['y'], float)

    def test_calculate_rotation_downward(self, hand_tracker):
        """Test rotation for downward direction"""
        direction = {'x': 0, 'y': -1, 'z': 0}
        rotation = hand_tracker._calculate_rotation_from_direction(direction)

        # Should have pitch (x-rotation)
        assert abs(rotation['x']) > 0


class TestHandTrackerSmoothing:
    """Test smoothing functionality"""

    def test_apply_smoothing(self, hand_tracker):
        """Test moving average smoothing"""
        # Add multiple frames to history
        for i in range(5):
            landmarks = [{'x': 0.1 * i, 'y': 0.1 * i, 'z': 0.1 * i, 'visibility': 0.9}]
            for _ in range(20):
                landmarks.append({'x': 0.5, 'y': 0.5, 'z': 0.1, 'visibility': 0.9})
            hand_tracker.landmark_history.append(landmarks)

        smoothed = hand_tracker._apply_smoothing()

        assert len(smoothed) == 21
        # First landmark should be smoothed toward middle value
        assert abs(smoothed[0]['x'] - 0.2) < 0.1

    def test_apply_smoothing_empty_history(self, hand_tracker):
        """Test smoothing with empty history"""
        hand_tracker.landmark_history.clear()

        smoothed = hand_tracker._apply_smoothing()
        assert smoothed == []


class TestHandTrackerFindTargetHand:
    """Test hand selection"""

    def test_find_target_hand_right(self, hand_tracker):
        """Test finding right hand"""
        # Mock MediaPipe results
        mock_handedness = Mock()
        mock_classification = Mock()
        mock_classification.label = 'Right'
        mock_classification.score = 0.95
        mock_handedness.classification = [mock_classification]

        mock_landmarks = Mock()

        results = Mock()
        results.multi_handedness = [mock_handedness]
        results.multi_hand_landmarks = [mock_landmarks]

        target = hand_tracker._find_target_hand(results, 'right')

        assert target is mock_landmarks

    def test_find_target_hand_not_found(self, hand_tracker):
        """Test when target hand is not found"""
        mock_handedness = Mock()
        mock_classification = Mock()
        mock_classification.label = 'Right'
        mock_classification.score = 0.95
        mock_handedness.classification = [mock_classification]

        mock_landmarks = Mock()

        results = Mock()
        results.multi_handedness = [mock_handedness]
        results.multi_hand_landmarks = [mock_landmarks]

        # Looking for left hand, but only right detected
        target = hand_tracker._find_target_hand(results, 'left')

        # Should return first hand as fallback
        assert target is mock_landmarks


class TestHandTrackerClose:
    """Test cleanup"""

    def test_close(self, hand_tracker):
        """Test resource cleanup"""
        hand_tracker.is_initialized = True
        hand_tracker.hands = Mock()
        hand_tracker.hands.close = Mock()

        hand_tracker.close()

        hand_tracker.hands.close.assert_called_once()
        assert not hand_tracker.is_initialized


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
