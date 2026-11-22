"""Flask application factory for ConnectMeet."""

import logging
import os
import sys
from logging.handlers import RotatingFileHandler

from flask import Flask, jsonify
from flask_jwt_extended.exceptions import JWTExtendedException
from jwt.exceptions import PyJWTError

from config import get_config

from .extensions import cors, db, jwt, migrate
from .services.meeting_service import MeetingError


def _configure_logging(app):
    """Console logging (stdout) + a rotating file log for the free tier."""
    level = logging.DEBUG if app.debug else logging.INFO
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s [%(name)s] %(message)s", "%Y-%m-%d %H:%M:%S"
    )

    app.logger.handlers.clear()

    stream = logging.StreamHandler(sys.stdout)
    stream.setFormatter(formatter)
    app.logger.addHandler(stream)

    try:
        os.makedirs("logs", exist_ok=True)
        file_handler = RotatingFileHandler(
            "logs/connectmeet.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        app.logger.addHandler(file_handler)
    except OSError:  # read-only filesystem — console logging is enough
        pass

    app.logger.setLevel(level)
    app.logger.propagate = False


def _register_error_handlers(app):
    # flask-jwt-extended ships its own `{"msg": ...}` handlers for its concrete
    # exception classes, which would shadow a generic JWTExtendedException
    # handler. Registering the supported loader callbacks keeps every auth
    # failure in our own consistent envelope — and always HTTP 401 so the
    # frontend can clear an expired session.
    def _unauthorized(message="Your session is invalid or has expired. Please log in again."):
        return jsonify({"message": message}), 401

    jwt.unauthorized_loader(lambda _msg: _unauthorized("Authentication required."))
    jwt.invalid_token_loader(lambda _msg: _unauthorized())
    jwt.revoked_token_loader(lambda: _unauthorized("Your session has been revoked."))
    jwt.needs_fresh_token_loader(lambda: _unauthorized("Please log in again to continue."))
    jwt.expired_token_loader(lambda _jwt_data, _jwt_header: _unauthorized())
    jwt.user_lookup_error_loader(lambda _jwt_error, _identity: _unauthorized())

    @app.errorhandler(JWTExtendedException)
    @app.errorhandler(PyJWTError)
    def handle_jwt_error(_exc):
        return _unauthorized()

    @app.errorhandler(MeetingError)
    def handle_meeting_error(exc: MeetingError):
        return (
            jsonify({"message": exc.message, **({"errors": exc.errors} if exc.errors else {})}),
            exc.status,
        )

    @app.errorhandler(404)
    def handle_404(_):
        return jsonify({"message": "Resource not found."}), 404

    @app.errorhandler(405)
    def handle_405(_):
        return jsonify({"message": "Method not allowed."}), 405

    @app.errorhandler(413)
    def handle_413(_):
        return jsonify({"message": "Request payload too large."}), 413

    @app.errorhandler(Exception)
    def handle_unexpected(exc):  # pragma: no cover - safety net
        app.logger.exception("unhandled error: %s", exc)
        # Never leak internals to the client.
        return jsonify({"message": "Something went wrong on the server."}), 500


def create_app(config_name: str | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(get_config(config_name))

    _configure_logging(app)

    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": _allowed_origins(app)}},
        supports_credentials=False,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    from .routes.auth import auth_bp
    from .routes.meetings import meetings_bp
    from .routes.agora import agora_bp
    from .routes.chat import chat_bp
    from .routes.profile import profile_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(meetings_bp)
    app.register_blueprint(agora_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(profile_bp)

    _register_error_handlers(app)
    _register_health(app)

    # Import models so `flask db migrate` sees the whole schema.
    from . import models  # noqa: F401

    with app.app_context():
        if app.config.get("CREATE_TABLES_ON_START") or os.getenv("CREATE_TABLES_ON_START") == "1":
            db.create_all()
            app.logger.info("database tables ensured")

    return app


def _allowed_origins(app) -> list[str]:
    origins = {app.config.get("FRONTEND_URL", "http://localhost:5173")}
    origins.update({"http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"})
    extra = os.getenv("EXTRA_CORS_ORIGINS", "")
    origins.update(o.strip() for o in extra.split(",") if o.strip())
    return sorted(origins)


def _register_health(app):
    @app.get("/")
    @app.get("/health")
    @app.get("/api/health")
    def health():
        """Liveness/readiness probe used by Render and by the frontend."""
        from .services.agora_service import health as agora_health

        db_ok = True
        try:
            db.session.execute(db.text("SELECT 1"))
        except Exception as exc:  # noqa: BLE001
            db_ok = False
            app.logger.warning("health.db check failed: %s", exc)

        payload = {
            "status": "ok" if db_ok else "degraded",
            "service": "connectmeet-api",
            "database": "up" if db_ok else "down",
            "agora": agora_health(),
        }
        return jsonify(payload), (200 if db_ok else 503)
