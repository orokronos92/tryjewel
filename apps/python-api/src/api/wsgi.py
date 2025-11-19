"""
WSGI entry point for Gunicorn

This module provides the WSGI application instance for production deployment.
"""
import os
from api.server import create_app

# Get configuration from environment
config_name = os.getenv('FLASK_ENV', 'production')

# Create application
app, socketio = create_app(config_name)

# For Gunicorn - expose app
application = app

if __name__ == '__main__':
    # This won't be called by Gunicorn, but useful for testing
    socketio.run(
        app,
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        debug=False
    )
