"""Development entry point:  python run.py"""

import os

from app import create_app

app = create_app(os.getenv("FLASK_ENV", "development"))

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    # 5001 by default: port 5000 is commonly occupied by other local services.
    # Render/Gunicorn ignore this and use $PORT.
    port = int(os.getenv("PORT", "5001"))
    app.run(host=host, port=port, debug=app.debug)
