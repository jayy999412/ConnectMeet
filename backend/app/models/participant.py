"""Participant model — one row per user per meeting session."""

from datetime import datetime, timezone

from ..extensions import db
from ..utils.timefmt import iso_utc

ROLE_HOST = "host"
ROLE_PARTICIPANT = "participant"

STATUS_ACTIVE = "active"
STATUS_LEFT = "left"
STATUS_REMOVED = "removed"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Participant(db.Model):
    __tablename__ = "participants"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    meeting_id = db.Column(
        db.Integer, db.ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role = db.Column(db.String(16), nullable=False, default=ROLE_PARTICIPANT)
    joined_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    left_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(16), nullable=False, default=STATUS_ACTIVE, index=True)

    meeting = db.relationship("Meeting", back_populates="participants")
    user = db.relationship("User", back_populates="participants")

    # Guarantees a user cannot have two active rows for the same meeting.
    __table_args__ = (
        db.UniqueConstraint("meeting_id", "user_id", name="uq_participant_meeting_user"),
        db.Index("ix_participants_meeting_status", "meeting_id", "status"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "meeting_id": self.meeting_id,
            "user_id": self.user_id,
            "name": self.user.name if self.user else "Participant",
            "role": self.role,
            "status": self.status,
            # Lets the UI mark one-off guests so hosts can tell them apart
            # from registered members.
            "is_guest": bool(self.user.is_guest) if self.user else False,
            "joined_at": iso_utc(self.joined_at),
            "left_at": iso_utc(self.left_at),
        }

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Participant {self.user_id}@{self.meeting_id} {self.status}>"
