"""
Main Flask application server

This module creates and configures the Flask application with Blueprints,
CORS, and SocketIO.
"""
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
import os

from config.settings import DevelopmentConfig, config
from utils.logger import setup_logger


def create_app(config_name='development'):
    """
    Create and configure Flask application

    Args:
        config_name: Configuration name ('development', 'testing', 'production')

    Returns:
        Configured Flask application
    """
    # Setup logger
    setup_logger(level=DevelopmentConfig.DEBUG and 'DEBUG' or 'INFO')

    # Create Flask app
    app = Flask(__name__)

    # Load configuration
    cfg = config[config_name]
    app.config.from_object(cfg)

    # CORS configuration
    CORS(
        app,
        origins=app.config.get('CORS_ORIGINS', ["http://localhost:3000"]),
        supports_credentials=True
    )

    # SocketIO configuration
    socketio = SocketIO(
        app,
        cors_allowed_origins=app.config.get('CORS_ORIGINS', ["http://localhost:3000"]),
        logger=True,
        engineio_logger=True
    )

    # Import and register blueprints
    try:
        from routes.health import health_bp
        from routes.tracking import tracking_bp

        app.register_blueprint(health_bp)
        app.register_blueprint(tracking_bp, url_prefix='/api')

    except Exception as e:
        from loguru import logger
        logger.error(f"Failed to register blueprints: {e}")
        raise

    # Add error handlers
    @app.errorhandler(404)
    def not_found(error):
        return {
            'success': False,
            'error': 'Endpoint not found'
        }, 404

    @app.errorhandler(500)
    def internal_error(error):
        return {
            'success': False,
            'error': 'Internal server error'
        }, 500

    @app.route('/')
    def index():
        """Root endpoint"""
        return {
            'service': 'Bijoux AI Tracking API',
            'version': '2.0',
            'status': 'running',
            'endpoints': {
                'health': '/health',
                'tracking': '/api/track',
                'websocket': '/socket.io/'
            }
        }

    # Store socketio in app for access
    app.socketio = socketio

    return app, socketio


def main():
    """Main entry point for development server"""
    # Create app
    app, socketio = create_app('development')

    # Run development server
    socketio.run(
        app,
        host='0.0.0.0',
        port=5000,
        debug=app.config['DEBUG']
    )


if __name__ == '__main__':
    main()
