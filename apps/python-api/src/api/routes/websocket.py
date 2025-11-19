"""
WebSocket handlers for real-time tracking

This module provides SocketIO event handlers for WebSocket connections.
"""
import base64
import numpy as np
from PIL import Image
import io
from flask import request
from flask_socketio import emit, disconnect
import json

from trackers.hand_tracker import HandTracker
from utils.cache import RedisCache
from config.settings import DevelopmentConfig
from utils.performance import track_performance

def register_socketio_handlers(socketio):
    """Register all SocketIO event handlers"""

    # Create a shared tracker instance per connection
    tracker = HandTracker()
    cache = RedisCache(
        redis_url=DevelopmentConfig.REDIS_URL,
        ttl_ms=DevelopmentConfig.REDIS_CACHE_TTL
    )

    @socketio.on('connect')
    def handle_connect():
        """Handle client connection"""
        try:
            if not tracker.is_initialized:
                tracker.initialize()
                print(f"[WebSocket] Tracker initialized for client {request.sid}")

            print(f"[WebSocket] Client connected: {request.sid}")

            emit('connection_response', {
                'status': 'connected',
                'message': 'WebSocket connection established',
                'client_id': request.sid
            })

        except Exception as e:
            error_msg = f"Failed to initialize tracker: {str(e)}"
            print(f"[WebSocket] {error_msg}")

            emit('connection_error', {
                'status': 'error',
                'message': error_msg
            })

            disconnect()

    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        print(f"[WebSocket] Client disconnected: {request.sid}")

    @socketio.on('track_frame')
    @track_performance
    def handle_track_frame(data):
        """Process a frame and emit tracking results"""
        try:
            # Extract frame data
            if not isinstance(data, dict):
                raise ValueError("Invalid data format - expected JSON object")

            image_base64 = data.get('image_base64')
            jewelry_type = data.get('jewelry_type', 'ring')
            finger = data.get('finger', 'index')
            hand = data.get('hand', 'right')
            frame_id = data.get('frame_id', f"frame_{request.sid}")
            client_timestamp = data.get('timestamp')

            # Validate required fields
            if not image_base64:
                raise ValueError("Missing 'image_base64' in frame data")

            if jewelry_type not in ['ring', 'bracelet']:
                raise ValueError(f"Unsupported jewelry_type: {jewelry_type}")

            # Initialize tracker if needed
            if not tracker.is_initialized:
                try:
                    tracker.initialize()
                    print(f"[WebSocket] Tracker initialized on-demand")
                except Exception as init_error:
                    raise RuntimeError(f"Tracker initialization failed: {str(init_error)}")

            # Decode image
            try:
                # Decode base64 to bytes
                image_bytes = base64.b64decode(image_base64)

                # Open with PIL
                pil_image = Image.open(io.BytesIO(image_bytes))

                # Convert to RGB if needed
                if pil_image.mode != 'RGB':
                    pil_image = pil_image.convert('RGB')

                # Convert to numpy array
                frame = np.array(pil_image)

            except Exception as e:
                raise ValueError(f"Error decoding frame: {str(e)}")

            # Check cache first
            if cache.is_connected():
                cached_result = cache.get_landmarks(frame_id)
                if cached_result:
                    print(f"[WebSocket] Cache hit for frame {frame_id}")

                    # Emit cached result
                    emit('tracking_results', {
                        'frame_id': frame_id,
                        'success': True,
                        'cached': True,
                        'jewelry_type': cached_result['jewelry_type'],
                        'jewelry_position': cached_result['jewelry_position'],
                        'confidence': cached_result['confidence'],
                        'processing_time_ms': 0,
                        'server_timestamp': client_timestamp
                    })

                    return

            # Process frame with tracker
            result = tracker.process_frame(
                frame,
                jewelry_type=jewelry_type,
                finger=finger,
                hand=hand
            )

            if result['success']:
                # Cache successful results
                if cache.is_connected():
                    try:
                        cache_data = {
                            'jewelry_type': result['jewelry_type'],
                            'jewelry_position': result['jewelry_position'],
                            'confidence': result['confidence']
                        }
                        cache.set_landmarks(frame_id, cache_data)
                        print(f"[WebSocket] Result cached for frame {frame_id}")
                    except Exception as cache_error:
                        print(f"[WebSocket] Cache error: {str(cache_error)}")

                # Emit success result
                emit('tracking_results', {
                    'frame_id': frame_id,
                    'success': True,
                    'cached': False,
                    'jewelry_type': result['jewelry_type'],
                    'jewelry_position': result['jewelry_position'],
                    'confidence': result['confidence'],
                    'processing_time_ms': result['processing_time_ms'],
                    'server_timestamp': client_timestamp
                })

            else:
                # Emit error result
                emit('tracking_error', {
                    'frame_id': frame_id,
                    'success': False,
                    'error': result.get('error', 'Unknown tracking error'),
                    'error_code': 'TRACKING_FAILED'
                })

        except ValueError as ve:
            error_msg = f"Validation error: {str(ve)}"
            print(f"[WebSocket] {error_msg}")

            emit('tracking_error', {
                'frame_id': data.get('frame_id', 'unknown'),
                'success': False,
                'error': error_msg,
                'error_code': 'VALIDATION_ERROR'
            })

        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            print(f"[WebSocket] {error_msg}")
            import traceback
            traceback.print_exc()

            emit('tracking_error', {
                'frame_id': data.get('frame_id', 'unknown'),
                'success': False,
                'error': error_msg,
                'error_code': 'INTERNAL_ERROR'
            })

    @socketio.on('ping')
    def handle_ping():
        """Simple ping-pong for connection testing"""
        emit('pong', {'message': 'pong', 'timestamp': request.timestamp})

    print("[WebSocket] SocketIO handlers registered")
