"""Input validation helpers.

All validation happens server-side; the frontend rules are only a convenience.
Returns a dict of {field: message} — an empty dict means the input is valid.
"""

import re

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

PASSWORD_RULES = (
    ("length", "Password must be at least 8 characters long.", lambda p: len(p) >= 8),
    ("upper", "Add at least one uppercase letter.", lambda p: re.search(r"[A-Z]", p) is not None),
    ("lower", "Add at least one lowercase letter.", lambda p: re.search(r"[a-z]", p) is not None),
    ("digit", "Add at least one number.", lambda p: re.search(r"\d", p) is not None),
)


def validate_password(password: str) -> dict:
    errors = {}
    if not password:
        return {"password": "Password is required."}
    for _, message, rule in PASSWORD_RULES:
        if not rule(password):
            errors["password"] = message
            break
    return errors


def validate_registration(payload: dict) -> dict:
    errors = {}

    name = (payload.get("name") or "").strip()
    if not name:
        errors["name"] = "Full name is required."
    elif len(name) < 2:
        errors["name"] = "Name must be at least 2 characters."
    elif len(name) > 120:
        errors["name"] = "Name must be under 120 characters."

    email = (payload.get("email") or "").strip().lower()
    if not email:
        errors["email"] = "Email address is required."
    elif not EMAIL_RE.match(email) or len(email) > 255:
        errors["email"] = "Enter a valid email address."

    errors.update(validate_password(payload.get("password") or ""))

    return errors


def validate_login(payload: dict) -> dict:
    errors = {}
    email = (payload.get("email") or "").strip().lower()
    if not email:
        errors["email"] = "Email address is required."
    elif not EMAIL_RE.match(email):
        errors["email"] = "Enter a valid email address."
    if not payload.get("password"):
        errors["password"] = "Password is required."
    return errors


def validate_profile(payload: dict) -> dict:
    errors = {}
    name = (payload.get("name") or "").strip()
    if not name:
        errors["name"] = "Name is required."
    elif len(name) < 2 or len(name) > 120:
        errors["name"] = "Name must be between 2 and 120 characters."
    return errors


def validate_password_change(payload: dict) -> dict:
    errors = {}
    if not payload.get("current_password"):
        errors["current"] = "Current password is required."
    new_errors = validate_password(payload.get("new_password") or "")
    if new_errors:
        errors["next"] = next(iter(new_errors.values()))
    return errors


def validate_meeting(payload: dict) -> dict:
    errors = {}

    title = (payload.get("title") or "").strip()
    if not title:
        errors["title"] = "Meeting title is required."
    elif len(title) > 120:
        errors["title"] = "Title must be under 120 characters."

    password = payload.get("password")
    if password not in (None, ""):
        if not isinstance(password, str) or len(password) < 4:
            errors["password"] = "Meeting password must be at least 4 characters."
        elif len(password) > 64:
            errors["password"] = "Meeting password must be under 64 characters."

    scheduled_at = payload.get("scheduled_at")
    if scheduled_at not in (None, ""):
        from datetime import datetime

        try:
            parsed = datetime.fromisoformat(str(scheduled_at).replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                from datetime import timezone

                parsed = parsed.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            errors["scheduled_at"] = "Enter a valid date and time."

    return errors


def validate_message(payload: dict) -> dict:
    text = payload.get("message")
    if not isinstance(text, str) or not text.strip():
        return {"message": "Message cannot be empty."}
    if len(text) > 2000:
        return {"message": "Message must be under 2000 characters."}
    return {}
