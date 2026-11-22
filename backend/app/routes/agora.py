"""Agora token routes.

The App Certificate NEVER reaches the browser: the frontend asks for a token
only after JWT authentication, and the backend re-checks meeting access,
channel name and identity before signing anything.
"""

from flask import Blueprint, current_app
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import db
from ..models import User
from ..services import meeting_service as svc
from ..services.agora_service import AgoraConfigError, build_tokens, health
from ..utils.decorators import json_payload, rate_limit
from ..utils.responses import err, ok

agora_bp = Blueprint("agora", __name__, url_prefix="/api/agora")


@agora_bp.post("/token")
@jwt_required()
@rate_limit(max_requests=60, window_seconds=60, key_prefix="agora_token")
def issue_token():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return err("Session is no longer valid. Please log in again.", 401)

    payload = json_payload()
    meeting_id = payload.get("meetingId")
    if not isinstance(meeting_id, int):
        meeting_id = int(meeting_id) if str(meeting_id or "").isdigit() else None
    if not meeting_id:
        return err("meetingId is required.", 422, {"meetingId": "Required."})

    try:
        meeting = svc.get_meeting(meeting_id)
    except svc.MeetingError as exc:
        return err(exc.message, exc.status)

    if meeting.status == "ended":
        return err("This meeting has ended.", 410)

    participant = svc.get_participant(meeting, user)
    if not participant and meeting.host_id != user.id:
        return err("Join the meeting before requesting a video token.", 403)
    if participant and participant.status == "removed":
        return err("The host removed you from this meeting.", 403)

    # The channel name is derived from the meeting — clients cannot request
    # access to somebody else's channel.
    expected_channel = str(meeting.id)
    channel = str(payload.get("channel") or expected_channel)
    if channel != expected_channel:
        return err("Invalid channel name.", 400, {"channel": "Channel does not match the meeting."})

    role = "host" if meeting.host_id == user.id else "participant"
    try:
        tokens = build_tokens(channel=expected_channel, uid=user.id, role=role)
    except AgoraConfigError as exc:
        current_app.logger.error("agora.not_configured: %s", exc)
        return err(str(exc), 503, code="agora_not_configured")

    current_app.logger.info(
        "agora.token meeting=%s user=%s role=%s", meeting.id, user.id, role
    )
    return ok(tokens, message="Video token issued.")


@agora_bp.get("/health")
def agora_health():
    """Public, certificate-free configuration status for the UI."""
    return ok({"agora": health()})
