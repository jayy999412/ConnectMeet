"""Meeting routes — creation, discovery, joining, leaving, ending, history."""

import secrets

from flask import Blueprint, current_app, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import db
from ..models import Meeting, Participant, Recording, User, STATUS_ACTIVE
from ..services import meeting_service as svc
from ..utils.decorators import json_payload, rate_limit
from ..utils.responses import err, ok
from ..utils.tokens import issue_token
from ..utils.validators import validate_meeting

meetings_bp = Blueprint("meetings", __name__, url_prefix="/api/meetings")


def current_user() -> User:
    user = db.session.get(User, int(get_jwt_identity()))
    if not user:
        raise svc.MeetingError("Session is no longer valid. Please log in again.", 401)
    return user


# --------------------------------------------------------------------- create
@meetings_bp.post("")
@jwt_required()
def create_meeting():
    user = current_user()
    payload = json_payload()
    errors = validate_meeting(payload)
    if errors:
        return err("Please fix the highlighted fields.", 422, errors=errors)

    meeting = svc.create_meeting(user, payload)
    current_app.logger.info(
        "meeting.created id=%s code=%s host=%s", meeting.id, meeting.meeting_code, user.id
    )
    return ok({"meeting": meeting.to_dict()}, 201, message="Meeting created.")


# ---------------------------------------------------------------------- lists
@meetings_bp.get("")
@jwt_required()
def list_meetings():
    """`?scope=stats` / `?scope=dashboard` power the overview page."""
    user = current_user()
    scope = request.args.get("scope", "all")

    if scope == "stats":
        return ok({"stats": svc.dashboard_stats(user)})
    if scope == "dashboard":
        return ok(svc.dashboard_lists(user))
    if scope == "hosted":
        rows = (
            Meeting.query.filter(Meeting.host_id == user.id)
            .order_by(Meeting.created_at.desc())
            .limit(50)
            .all()
        )
        return ok({"meetings": [m.to_dict() for m in rows]})

    rows = (
        Meeting.query.join(Participant, Participant.meeting_id == Meeting.id)
        .filter(Participant.user_id == user.id)
        .order_by(Meeting.created_at.desc())
        .limit(50)
        .all()
    )
    return ok({"meetings": [m.to_dict() for m in rows]})


@meetings_bp.get("/history")
@jwt_required()
def history():
    user = current_user()
    return ok({"meetings": svc.meeting_history(user)})


# ------------------------------------------------------------ resolve by code
@meetings_bp.get("/code/<string:code>")
@rate_limit(max_requests=30, window_seconds=60, key_prefix="resolve")
def resolve(code: str):
    """Invite links carry the human-friendly code; the room uses the numeric id.

    Public on purpose: the join page must show the meeting to a visitor who has
    no account yet. Only non-sensitive fields are returned (no host email, no
    password hash) and the endpoint is rate-limited so codes cannot be
    enumerated at any useful pace.
    """
    meeting = svc.resolve_code(code)
    return ok(
        {
            "meeting": {
                "id": meeting.id,
                "meeting_code": meeting.meeting_code,
                "title": meeting.title,
                "status": meeting.status,
                "has_password": meeting.has_password,
                "scheduled_at": meeting.scheduled_at.isoformat() if meeting.scheduled_at else None,
            }
        }
    )


# ----------------------------------------------------------------- read one
@meetings_bp.get("/<int:meeting_id>")
@jwt_required()
def get_meeting(meeting_id: int):
    user = current_user()
    meeting = svc.get_meeting(meeting_id)
    return ok(svc.meeting_detail(meeting, user))


# --------------------------------------------------------------------- join
@meetings_bp.post("/<int:meeting_id>/join")
@jwt_required()
@rate_limit(max_requests=60, window_seconds=60, key_prefix="join")
def join(meeting_id: int):
    user = current_user()
    payload = json_payload()
    meeting = svc.get_meeting(meeting_id)
    participant = svc.join_meeting(meeting, user, payload.get("password"))
    current_app.logger.info(
        "meeting.join meeting=%s user=%s role=%s", meeting.id, user.id, participant.role
    )
    return ok(
        {
            "meeting": meeting.to_dict(),
            "participant": participant.to_dict(),
            "you": {"role": participant.role, "status": participant.status},
            "participants": svc.serialize_participants(meeting),
        },
        message="Joined the meeting.",
    )


# --------------------------------------------------------------- guest join
@meetings_bp.post("/<int:meeting_id>/guest-join")
@rate_limit(max_requests=20, window_seconds=60, key_prefix="guest_join")
def guest_join(meeting_id: int):
    """Join with a display name only — no account, no email, no signup wall.

    This is the Zoom-style flow invite links need: the recipient types the name
    everyone will see and is in the room. A throwaway `is_guest` user row is
    created so every existing rule keeps working unchanged — participants FK,
    host-only permissions, Agora uid == user id, chat ownership.

    The guest never learns the random password that is generated for the row,
    so the account cannot be taken over later.
    """
    payload = json_payload()
    name = str(payload.get("name") or "").strip()
    if not 2 <= len(name) <= 60:
        return err(
            "Please enter your name to join.",
            422,
            {"name": "Enter a name (2-60 characters)."},
        )

    # Resolves (404) before any account is created.
    meeting = svc.get_meeting(meeting_id)

    guest = User(
        name=name,
        email=f"guest-{secrets.token_hex(8)}@connectmeet.invalid",
        is_guest=True,
    )
    guest.set_password(secrets.token_urlsafe(24))  # random; never disclosed
    db.session.add(guest)
    try:
        # Allocate the guest id so join_meeting can satisfy the participants FK.
        db.session.flush()
        participant = svc.join_meeting(meeting, guest, payload.get("password"))
    except Exception:
        # Wrong password / ended / removed: never leave an orphaned guest row.
        db.session.rollback()
        raise

    current_app.logger.info(
        "meeting.guest_join meeting=%s guest=%s role=%s",
        meeting.id,
        guest.id,
        participant.role,
    )
    return ok(
        {
            "token": issue_token(guest),
            "user": guest.to_dict(),
            "meeting": meeting.to_dict(),
            "participant": participant.to_dict(),
            "you": {"role": participant.role, "status": participant.status},
            "participants": svc.serialize_participants(meeting),
        },
        201,
        message="Joined the meeting.",
    )


# -------------------------------------------------------------------- leave
@meetings_bp.post("/<int:meeting_id>/leave")
@jwt_required()
def leave(meeting_id: int):
    user = current_user()
    meeting = svc.get_meeting(meeting_id)
    participant = svc.leave_meeting(meeting, user)
    current_app.logger.info("meeting.leave meeting=%s user=%s", meeting.id, user.id)
    return ok(
        {"participant": participant.to_dict() if participant else None},
        message="Left the meeting.",
    )


# ---------------------------------------------------------------------- end
@meetings_bp.post("/<int:meeting_id>/end")
@jwt_required()
def end(meeting_id: int):
    user = current_user()
    meeting = svc.get_meeting(meeting_id)
    meeting = svc.end_meeting(meeting, user)
    current_app.logger.info("meeting.end meeting=%s by=%s", meeting.id, user.id)
    return ok({"meeting": meeting.to_dict()}, message="Meeting ended for everyone.")


# --------------------------------------------------------------- participants
@meetings_bp.get("/<int:meeting_id>/participants")
@jwt_required()
def participants(meeting_id: int):
    user = current_user()
    meeting = svc.get_meeting(meeting_id)
    if not svc.get_participant(meeting, user) and meeting.host_id != user.id:
        return err("Join the meeting before viewing its participants.", 403)
    return ok({"participants": svc.serialize_participants(meeting)})


@meetings_bp.delete("/<int:meeting_id>/participants/<int:user_id>")
@jwt_required()
def remove_participant(meeting_id: int, user_id: int):
    actor = current_user()
    meeting = svc.get_meeting(meeting_id)
    target = svc.remove_participant(meeting, actor, user_id)
    current_app.logger.warning(
        "meeting.remove_participant meeting=%s target=%s by=%s", meeting.id, user_id, actor.id
    )
    return ok({"participant": target.to_dict()}, message="Participant removed.")


# ---------------------------------------------------------------- recordings
@meetings_bp.get("/<int:meeting_id>/recordings")
@jwt_required()
def list_recordings(meeting_id: int):
    user = current_user()
    meeting = svc.get_meeting(meeting_id)
    svc.can_read_chat(meeting, user)  # same authorization rule as chat
    rows = Recording.query.filter_by(meeting_id=meeting.id).order_by(Recording.started_at.desc()).all()
    return ok({"recordings": [r.to_dict() for r in rows]})


@meetings_bp.post("/<int:meeting_id>/recordings")
@jwt_required()
def log_local_recording(meeting_id: int):
    """Register a *local* (browser MediaRecorder) session.

    `recording_url` is intentionally NULL: the file never leaves the
    participant's device, because free cloud storage cannot be guaranteed.
    """
    user = current_user()
    meeting = svc.get_meeting(meeting_id)
    if not svc.get_participant(meeting, user) and meeting.host_id != user.id:
        return err("Join the meeting before logging a recording.", 403)

    payload = json_payload()
    rec = Recording(
        meeting_id=meeting.id,
        user_id=user.id,
        recording_url=None,
        status="local_device" if payload.get("status") != "failed" else "failed",
    )
    if payload.get("ended"):
        from datetime import datetime, timezone

        rec.ended_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.session.add(rec)
    db.session.commit()
    return ok({"recording": rec.to_dict()}, 201, message="Local recording logged.")
