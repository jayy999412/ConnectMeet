"""WSGI entry point used by Gunicorn in production.

Render start command:
    gunicorn --workers 2 --threads 4 --timeout 120 --bind 0.0.0.0:$PORT wsgi:app
"""

import os

from app import create_app

app = create_app(os.getenv("FLASK_ENV", "production"))
