"""Profile routes — view, update and change password."""

from flask import Blueprint, current_app
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from ..models import User
from ..utils.decorators import json_payload, rate_limit
from ..utils.responses import err, ok
from ..utils.validators import validate_password, validate_password_change, validate_profile

profile_bp = Blueprint("profile", __name__, url_prefix="/api/profile")


def _current_user() -> User | None:
    identity = get_jwt_identity()
    return db.session.get(User, int(identity)) if identity else None


@profile_bp.get("")
@jwt_required()
def get_profile():
    user = _current_user()
    if not user:
        return err("Session is no longer valid. Please log in again.", 401)
    return ok({"user": user.to_dict()})


@profile_bp.put("")
@jwt_required()
def update_profile():
    user = _current_user()
    if not user:
        return err("Session is no longer valid. Please log in again.", 401)

    payload = json_payload()
    errors = validate_profile(payload)
    if errors:
        return err("Please fix the highlighted fields.", 422, errors=errors)

    user.name = payload["name"].strip()

    # Optional free-tier image upload: a data URL is stored directly in the
    # column so no paid object-storage service is required. Bounded to ~1 MB.
    image = payload.get("profile_image")
    if isinstance(image, str) and image.startswith("data:image/"):
        if len(image) > 1_400_000:
            return err("Image must be smaller than 1 MB.", 413)
        user.profile_image = image
    elif image in ("", None) and "profile_image" in payload:
        user.profile_image = None

    db.session.commit()
    current_app.logger.info("profile.updated user_id=%s", user.id)
    return ok({"user": user.to_dict()}, message="Profile updated.")


@profile_bp.post("/change-password")
@jwt_required()
@rate_limit(max_requests=10, window_seconds=60, key_prefix="change_password")
def change_password():
    user = _current_user()
    if not user:
        return err("Session is no longer valid. Please log in again.", 401)

    payload = json_payload()
    errors = validate_password_change(payload)
    if errors:
        return err("Please fix the highlighted fields.", 422, errors=errors)

    if not check_password_hash(user.password_hash, payload["current_password"]):
        return err("Your current password is incorrect.", 401, {"current": "Incorrect password."})

    new_errors = validate_password(payload["new_password"])
    if new_errors:
        return err("Please fix the highlighted fields.", 422, errors={"next": next(iter(new_errors.values()))})

    user.password_hash = generate_password_hash(payload["new_password"])
    db.session.commit()

    current_app.logger.info("profile.password_changed user_id=%s", user.id)
    return ok(message="Password changed successfully.")
