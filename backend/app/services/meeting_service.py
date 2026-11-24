"""Meeting business logic — creation, joining, leaving, history and stats.

Keeping this out of the routes means the HTTP layer stays thin and the rules
(password checks, status transitions, host permissions) live in one place.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload

from ..extensions import db
from ..models import (
    Meeting,
    Message,
    Participant,
    User,
    ROLE_HOST,
    ROLE_PARTICIPANT,
    STATUS_ACTIVE,
    STATUS_ENDED,
    STATUS_LEFT,
    STATUS_REMOVED,
    STATUS_LIVE,
    STATUS_WAITING,
)
from ..utils.timefmt import iso_utc

DEFAULT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I ambiguity


class MeetingError(Exception):
    """Domain error carrying an HTTP status and optional field errors."""

    def __init__(self, message: str, status: int = 400, errors: dict | None = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.errors = errors


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_meeting_code(alphabet: str = DEFAULT_ALPHABET, length: int = 10) -> str:
    """Random, collision-checked code that is hard to guess."""
    for _ in range(12):
        code = "".join(secrets.choice(alphabet) for _ in range(length))
        formatted = f"{code[:5]}-{code[5:]}" if length >= 10 else code
        exists = db.session.query(Meeting.id).filter_by(meeting_code=formatted).first()
        if not exists:
            return formatted
    raise MeetingError("Could not allocate a unique meeting code, please retry.", 500)


def create_meeting(host: User, payload: dict) -> Meeting:
    code = generate_meeting_code()

    scheduled_at = None
    raw = payload.get("scheduled_at")
    if raw:
        scheduled_at = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
        if scheduled_at.tzinfo is not None:
            # MySQL DATETIME has no timezone — store UTC.
            scheduled_at = scheduled_at.astimezone(timezone.utc).replace(tzinfo=None)

    meeting = Meeting(
        meeting_code=code,
        title=str(payload.get("title")).strip(),
        host_id=host.id,
        status=STATUS_WAITING,
        scheduled_at=scheduled_at,
        started_at=None,
        ended_at=None,
    )
    meeting.set_password(payload.get("password") or None)

    db.session.add(meeting)
    db.session.flush()

    # The creator is always recorded as an active host participant.
    db.session.add(
        Participant(
            meeting_id=meeting.id,
            user_id=host.id,
            role=ROLE_HOST,
            joined_at=utcnow(),
            status=STATUS_ACTIVE,
        )
    )
    db.session.commit()
    return meeting


def get_meeting(meeting_id: int) -> Meeting:
    meeting = (
        Meeting.query.options(joinedload(Meeting.host))
        .filter(Meeting.id == meeting_id)
        .first()
    )
    if not meeting:
        raise MeetingError("Meeting not found. Check the meeting ID and try again.", 404)
    return meeting


def resolve_code(code: str) -> Meeting:
    """Look up a meeting by its human-friendly code (case-insensitive)."""
    cleaned = (code or "").strip().upper()
    if not cleaned:
        raise MeetingError("Enter a meeting ID.", 422, {"code": "Enter a meeting ID."})
    meeting = (
        Meeting.query.options(joinedload(Meeting.host))
        .filter(func.upper(Meeting.meeting_code) == cleaned)
        .first()
    )
    if not meeting:
        raise MeetingError("Meeting not found. Check the meeting ID and try again.", 404)
    return meeting


def current_role(meeting: Meeting, user: User) -> str:
    return ROLE_HOST if meeting.host_id == user.id else ROLE_PARTICIPANT


def get_participant(meeting: Meeting, user: User) -> Participant | None:
    return Participant.query.filter_by(meeting_id=meeting.id, user_id=user.id).first()


def active_participants(meeting: Meeting) -> list[Participant]:
    return (
        Participant.query.options(joinedload(Participant.user))
        .filter(
            Participant.meeting_id == meeting.id,
            Participant.status == STATUS_ACTIVE,
        )
        .order_by(Participant.joined_at.asc())
        .all()
    )


def join_meeting(meeting: Meeting, user: User, password: str | None) -> Participant:
    """Register (or re-register) the user as an active participant."""
    if meeting.status == STATUS_ENDED:
        raise MeetingError("This meeting has ended. Ask the host to start a new one.", 410)

    if meeting.scheduled_at:
        # scheduled_at is stored as naive UTC by MySQL; normalize both sides
        # to naive UTC so this comparison can never raise TypeError.
        scheduled = (
            meeting.scheduled_at.replace(tzinfo=None)
            if meeting.scheduled_at.tzinfo
            else meeting.scheduled_at
        )
        if scheduled > utcnow().replace(tzinfo=None):
            local = scheduled.strftime("%d %b %Y, %H:%M UTC")
            raise MeetingError(f"This meeting is scheduled for {local} and has not started yet.", 409)

    if meeting.has_password:
        existing = get_participant(meeting, user)
        # A returning active participant does not need to re-enter the password.
        already_joined = existing is not None and existing.status == STATUS_ACTIVE
        if not already_joined and not meeting.check_password(password or ""):
            raise MeetingError("Incorrect meeting password.", 401, {"password": "Incorrect meeting password."})

    participant = get_participant(meeting, user)

    if participant and participant.status == STATUS_REMOVED:
        raise MeetingError("The host removed you from this meeting.", 403)

    if participant:
        participant.status = STATUS_ACTIVE
        participant.left_at = None
        participant.joined_at = participant.joined_at or utcnow()
        if meeting.host_id == user.id:
            participant.role = ROLE_HOST
    else:
        participant = Participant(
            meeting_id=meeting.id,
            user_id=user.id,
            role=ROLE_HOST if meeting.host_id == user.id else ROLE_PARTICIPANT,
            joined_at=utcnow(),
            status=STATUS_ACTIVE,
        )
        db.session.add(participant)

    # First person in the room flips the meeting to live.
    if meeting.status in (STATUS_WAITING, STATUS_LIVE):
        if meeting.started_at is None:
            meeting.started_at = utcnow()
        meeting.status = STATUS_LIVE

    db.session.commit()
    return participant


def leave_meeting(meeting: Meeting, user: User) -> Participant | None:
    participant = get_participant(meeting, user)
    if participant and participant.status == STATUS_ACTIVE:
        participant.status = STATUS_LEFT
        participant.left_at = utcnow()
        db.session.commit()
    return participant


def end_meeting(meeting: Meeting, user: User) -> Meeting:
    if meeting.host_id != user.id:
        raise MeetingError("Only the host can end this meeting.", 403)
    if meeting.status == STATUS_ENDED:
        return meeting

    meeting.status = STATUS_ENDED
    meeting.ended_at = utcnow()

    # Close out everyone who is still marked active.
    Participant.query.filter(
        Participant.meeting_id == meeting.id,
        Participant.status == STATUS_ACTIVE,
    ).update({"status": STATUS_LEFT, "left_at": utcnow()}, synchronize_session=False)

    db.session.commit()
    return meeting


def remove_participant(meeting: Meeting, actor: User, target_user_id: int) -> Participant:
    if meeting.host_id != actor.id:
        raise MeetingError("Only the host can remove participants.", 403)
    if target_user_id == actor.id:
        raise MeetingError("The host cannot remove themselves.", 400)

    target = db.session.get(User, target_user_id)
    participant = get_participant(meeting, target) if target else None
    if not participant or participant.status != STATUS_ACTIVE:
        raise MeetingError("That participant is not in this meeting.", 404)

    participant.status = STATUS_REMOVED
    participant.left_at = utcnow()
    db.session.commit()
    return target


def serialize_participants(meeting: Meeting) -> list[dict]:
    return [p.to_dict() for p in active_participants(meeting)]


def meeting_detail(meeting: Meeting, user: User) -> dict:
    """Payload for GET /api/meetings/:id (used by the room's status polling)."""
    participant = get_participant(meeting, user)
    role = ROLE_HOST if meeting.host_id == user.id else ROLE_PARTICIPANT

    # Only the host or someone who has joined before may inspect the room.
    if not participant and meeting.host_id != user.id:
        raise MeetingError(
            "You have not joined this meeting. Use the join page to enter.", 403
        )

    return {
        "meeting": meeting.to_dict(),
        "participants": serialize_participants(meeting),
        "you": {
            "role": role,
            "status": participant.status if participant else None,
        },
    }


def _history_query(user: User):
    return (
        Participant.query.options(
            joinedload(Participant.meeting).joinedload(Meeting.host),
            joinedload(Participant.user),
        )
        .join(Meeting, Meeting.id == Participant.meeting_id)
        .filter(Participant.user_id == user.id)
    )


def meeting_history(user: User) -> list[dict]:
    rows = (
        _history_query(user)
        .order_by(func.coalesce(Participant.joined_at, Meeting.created_at).desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": row.id,
            "meeting_id": row.meeting_id,
            "meeting_code": row.meeting.meeting_code,
            "title": row.meeting.title,
            "role": row.role,
            "host_name": row.meeting.host.name if row.meeting.host else "Unknown",
            "meeting_status": row.meeting.status,
            "created_at": iso_utc(row.meeting.created_at),
            "started_at": iso_utc(row.meeting.started_at),
            "ended_at": iso_utc(row.meeting.ended_at),
            "joined_at": iso_utc(row.joined_at),
            "left_at": iso_utc(row.left_at),
            "participant_status": row.status,
        }
        for row in rows
    ]


def dashboard_stats(user: User) -> dict:
    """Real counters — no fabricated numbers."""
    hosted = (
        db.session.query(func.count(Meeting.id))
        .filter(Meeting.host_id == user.id)
        .scalar()
        or 0
    )

    joined_ids = db.session.query(Participant.meeting_id).filter(
        Participant.user_id == user.id
    )
    total = (
        db.session.query(func.count(func.distinct(Meeting.id)))
        .filter(or_(Meeting.host_id == user.id, Meeting.id.in_(joined_ids)))
        .scalar()
        or 0
    )
    joined_distinct = (
        db.session.query(func.count(func.distinct(Participant.meeting_id)))
        .filter(Participant.user_id == user.id)
        .scalar()
        or 0
    )
    completed = (
        db.session.query(func.count(Meeting.id))
        .filter(Meeting.host_id == user.id, Meeting.status == STATUS_ENDED)
        .scalar()
        or 0
    )

    return {
        "total": int(total),
        "hosted": int(hosted),
        "joined": int(max(joined_distinct - hosted, 0)),
        "completed": int(completed),
    }


def dashboard_lists(user: User, limit: int = 5) -> dict:
    upcoming_rows = (
        Meeting.query.options(joinedload(Meeting.host))
        .filter(
            Meeting.host_id == user.id,
            Meeting.status != STATUS_ENDED,
        )
        .order_by(Meeting.created_at.desc())
        .limit(limit)
        .all()
    )

    recent_rows = (
        _history_query(user)
        .order_by(func.coalesce(Participant.joined_at, Meeting.created_at).desc())
        .limit(limit)
        .all()
    )

    def _upcoming(meeting: Meeting) -> dict:
        return {
            "id": meeting.id,
            "meeting_code": meeting.meeting_code,
            "title": meeting.title,
            "status": meeting.status,
            "role": ROLE_HOST,
            "scheduled_at": iso_utc(meeting.scheduled_at),
            "created_at": iso_utc(meeting.created_at),
        }

    def _recent(row: Participant) -> dict:
        return {
            "id": row.meeting_id,
            "meeting_code": row.meeting.meeting_code,
            "title": row.meeting.title,
            "status": row.meeting.status,
            "role": row.role,
            "scheduled_at": iso_utc(row.meeting.scheduled_at),
            "created_at": iso_utc(row.meeting.created_at),
        }

    return {
        "upcoming": [_upcoming(m) for m in upcoming_rows],
        "recent": [_recent(r) for r in recent_rows],
    }


def can_read_chat(meeting: Meeting, user: User) -> None:
    """Chat history is restricted to the host or previous participants."""
    participant = get_participant(meeting, user)
    if not participant and meeting.host_id != user.id:
        raise MeetingError("Join the meeting before reading its chat history.", 403)


def validate_chat_message(meeting: Meeting, user: User, text: str) -> None:
    if meeting.status == STATUS_ENDED:
        raise MeetingError("This meeting has ended.", 410)
    if len(text) > 2000:
        raise MeetingError("Message must be under 2000 characters.", 422)
