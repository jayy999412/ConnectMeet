"""Meeting chat routes — history and posting, scoped per meeting."""

from flask import Blueprint, current_app, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import db
from ..models import Message, User
from ..services import meeting_service as svc
from ..utils.decorators import json_payload, rate_limit
from ..utils.responses import err, ok
from ..utils.validators import validate_message

chat_bp = Blueprint("chat", __name__, url_prefix="/api/meetings")


def _current_user() -> User:
    user = db.session.get(User, int(get_jwt_identity()))
    if not user:
        raise svc.MeetingError("Session is no longer valid. Please log in again.", 401)
    return user


@chat_bp.get("/<int:meeting_id>/messages")
@jwt_required()
def list_messages(meeting_id: int):
    """Chat history is only readable by the host or a participant."""
    user = _current_user()
    meeting = svc.get_meeting(meeting_id)
    svc.can_read_chat(meeting, user)

    limit = min(int(request.args.get("limit", 200)), 500)
    after = request.args.get("after", type=int)

    query = Message.query.filter(Message.meeting_id == meeting.id)
    if after:
        query = query.filter(Message.id > after)

    rows = query.order_by(Message.id.desc()).limit(limit).all()
    rows.reverse()  # oldest → newest
    return ok({"messages": [m.to_dict() for m in rows]})


@chat_bp.post("/<int:meeting_id>/messages")
@jwt_required()
@rate_limit(max_requests=120, window_seconds=60, key_prefix="chat")
def post_message(meeting_id: int):
    user = _current_user()
    meeting = svc.get_meeting(meeting_id)

    # Authorization: must be the host or an active/left participant.
    participant = svc.get_participant(meeting, user)
    if not participant and meeting.host_id != user.id:
        return err("Join the meeting before sending messages.", 403)
    if participant and participant.status == "removed":
        return err("The host removed you from this meeting.", 403)

    payload = json_payload()
    errors = validate_message(payload)
    if errors:
        return err("Please fix the highlighted fields.", 422, errors=errors)

    svc.validate_chat_message(meeting, user, payload["message"])

    message = Message(meeting_id=meeting.id, sender_id=user.id, message=payload["message"].strip())
    db.session.add(message)
    db.session.commit()

    current_app.logger.info("chat.message meeting=%s user=%s id=%s", meeting.id, user.id, message.id)
    # `message` is the reserved status key of the response envelope, so no
    # status text is passed here — the payload key must stay `message`.
    return ok({"message": message.to_dict()}, 201)
