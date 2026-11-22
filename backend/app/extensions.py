"""Shared extension objects.

Extensions are initialised inside `create_app()` to avoid circular imports
(the standard Flask application-factory pattern).
"""

from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
jwt = JWTManager()
migrate = Migrate()
cors = CORS()
