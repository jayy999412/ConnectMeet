"""Message model — meeting chat persisted in MySQL."""

from datetime import datetime, timezone

from ..extensions import db
from ..utils.timefmt import iso_utc


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    meeting_id = db.Column(
        db.Integer, db.ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)

    meeting = db.relationship("Meeting", back_populates="messages")
    sender = db.relationship("User", back_populates="messages")

    __table_args__ = (db.Index("ix_messages_meeting_created", "meeting_id", "created_at"),)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "meeting_id": self.meeting_id,
            "sender_id": self.sender_id,
            "sender_name": self.sender.name if self.sender else "Participant",
            "message": self.message,
            "created_at": iso_utc(self.created_at),
        }

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Message {self.id} meeting={self.meeting_id}>"
