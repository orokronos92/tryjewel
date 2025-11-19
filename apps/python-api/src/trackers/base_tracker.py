"""
Base class for all MediaPipe trackers

This module defines the abstract base class for all tracker implementations.
"""
from abc import ABC, abstractmethod
from typing import Dict, Optional
import numpy as np


class BaseTracker(ABC):
    """Base class for all MediaPipe trackers"""

    def __init__(self, config: Dict):
        self.config = config
        self.is_initialized = False

    @abstractmethod
    def initialize(self):
        """Initialize MediaPipe model"""
        pass

    @abstractmethod
    def process_frame(self, frame: np.ndarray) -> Dict:
        """Process frame and return tracking results"""
        pass

    @abstractmethod
    def close(self):
        """Cleanup resources"""
        pass
