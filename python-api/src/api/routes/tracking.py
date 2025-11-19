"""Tracking endpoint

This module provides the jewelry tracking API endpoint.
"""
import base64
import numpy as np
from flask import Blueprint, request, jsonify
from PIL import Image
import io

from trackers.hand_tracker import HandTracker
from utils.validators import TrackingRequestSchema

# Initialize tracker instance
hand_tracker = HandTracker()

# Try to initialize on module load
try:
    if not hand_tracker.is_initialized:
        hand_tracker.initialize()
except Exception as e:
    print(f"Warning: Failed to initialize HandTracker: {e}")
    print("Tracker will be initialized on first request")

tracking_bp = Blueprint('tracking', __name__)


def decode_base64_image(image_base64: str) -> np.ndarray:
    """
    Decode base64 encoded image to numpy array

    Args:
        image_base64: Base64 encoded image string

    Returns:
        Image as numpy array (BGR format)
    """
    try:
        # Decode base64 to bytes
        image_bytes = base64.b64decode(image_base64)

        # Open with PIL
        pil_image = Image.open(io.BytesIO(image_bytes))

        # Convert BGR format (OpenCV default)
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')

        # Convert to numpy array
        frame = np.array(pil_image)

        return frame

    except Exception as e:
        raise ValueError(f"Failed to decode image: {str(e)}")


@tracking_bp.route('/track', methods=['POST'])
def track_jewelry():
    """Track jewelry position endpoint"""
    try:
        # Get JSON data
        data = request.get_json()

        if not data:
            return jsonify({
                'success': False,
                'error': 'No JSON data provided'
            }), 400

        # Validate with Pydantic schema
        schema = TrackingRequestSchema()

        try:
            validated = schema.model_validate(data)
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'Validation error: {str(e)}'
            }), 400

        # Initialize tracker if not already done
        if not hand_tracker.is_initialized:
            try:
                hand_tracker.initialize()
            except Exception as e:
                return jsonify({
                    'success': False,
                    'error': f'Failed to initialize tracker: {str(e)}'
                }), 500

        # Decode image
        try:
            frame = decode_base64_image(validated.image.image_data)
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'Image decode error: {str(e)}'
            }), 400

        # Route to correct tracker
        if validated.jewelry_type in ['ring', 'bracelet']:
            result = hand_tracker.process_frame(
                frame,
                jewelry_type=validated.jewelry_type,
                finger=validated.finger or 'index',
                hand=validated.hand or 'right'
            )
        else:
            return jsonify({
                'success': False,
                'error': f'Unsupported jewelry type: {validated.jewelry_type}'
            }), 400

        # Add processing metadata
        result['request_id'] = validated.request_id

        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500
