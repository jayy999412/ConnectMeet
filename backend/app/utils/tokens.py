"""JWT issuance shared by every flow that starts a session.

Kept in one place so login, registration and guest-join all mint identical
tokens (same identity format, same expiry) instead of drifting apart.
"""

from datetime import timedelta

from flask import current_app
from flask_jwt_extended import create_access_token

from ..models import User


def issue_token(user: User) -> str:
    expires = timedelta(hours=int(current_app.config.get("JWT_ACCESS_TOKEN_EXPIRES_HOURS", "12")))
    return create_access_token(identity=str(user.id), expires_delta=expires)
