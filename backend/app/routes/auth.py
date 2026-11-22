"""Authentication routes: register, login, current user, logout."""

from datetime import timedelta

from flask import Blueprint, current_app
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required,
)

from ..extensions import db
from ..models import User
from ..utils.decorators import json_payload, rate_limit
from ..utils.responses import err, ok
from ..utils.validators import validate_login, validate_registration

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _issue_token(user: User) -> str:
    expires = timedelta(hours=int(current_app.config.get("JWT_ACCESS_TOKEN_EXPIRES_HOURS", "12")))
    return create_access_token(identity=str(user.id), expires_delta=expires)


@auth_bp.post("/register")
@rate_limit(max_requests=10, window_seconds=60, key_prefix="register")
def register():
    """Create a new account. Passwords are hashed, never stored plain text."""
    payload = json_payload()
    errors = validate_registration(payload)
    if errors:
        return err("Please fix the highlighted fields.", 422, errors=errors)

    email = payload["email"].strip().lower()
    if User.query.filter(db.func.lower(User.email) == email).first():
        return err("An account with this email already exists.", 409, {"email": "This email is already registered."})

    user = User(name=payload["name"].strip(), email=email)
    user.set_password(payload["password"])
    db.session.add(user)
    db.session.commit()

    current_app.logger.info("user.registered user_id=%s email=%s", user.id, email)
    return ok(
        {"token": _issue_token(user), "user": user.to_dict()},
        201,
        message="Account created successfully.",
    )


@auth_bp.post("/login")
@rate_limit(max_requests=15, window_seconds=60, key_prefix="login")
def login():
    payload = json_payload()
    errors = validate_login(payload)
    if errors:
        return err("Please fix the highlighted fields.", 422, errors=errors)

    email = payload["email"].strip().lower()
    user = User.query.filter(db.func.lower(User.email) == email).first()

    # Identical message for unknown email / wrong password (no user enumeration).
    if not user or not user.check_password(payload["password"]):
        current_app.logger.warning("auth.login_failed email=%s", email)
        return err("Invalid email address or password.", 401)

    current_app.logger.info("auth.login user_id=%s", user.id)
    return ok({"token": _issue_token(user), "user": user.to_dict()}, message="Logged in successfully.")


@auth_bp.get("/me")
@jwt_required()
def me():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user:
        return err("Session is no longer valid. Please log in again.", 401)
    return ok({"user": user.to_dict()})


@auth_bp.post("/logout")
@jwt_required()
def logout():
    """Stateless JWT — the client discards the token; we acknowledge the event."""
    user_id = get_jwt_identity()
    current_app.logger.info("auth.logout user_id=%s", user_id)
    return ok(message="Logged out successfully.")
