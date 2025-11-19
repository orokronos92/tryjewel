"""Health check endpoint

This module provides the health check API endpoint.
"""
from flask import Blueprint, jsonify
from trackers.hand_tracker import HandTracker

# Initialize tracker instance (simple singleton for now)
hand_tracker = HandTracker()

health_bp = Blueprint('health', __name__)


@health_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'Bijoux AI Tracking API',
        'version': '2.0',
        'mediapipe_loaded': hand_tracker.is_initialized
    })
