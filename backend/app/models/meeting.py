"""Meeting model — rooms created by a host."""

from datetime import datetime, timezone

from ..extensions import db
from ..utils.timefmt import iso_utc

# meeting.status lifecycle
STATUS_WAITING = "waiting"  # created, nobody has joined yet
STATUS_LIVE = "live"  # at least one participant joined
STATUS_ENDED = "ended"  # host ended it (or it was closed)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Meeting(db.Model):
    __tablename__ = "meetings"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    meeting_code = db.Column(db.String(20), nullable=False, unique=True, index=True)
    title = db.Column(db.String(120), nullable=False)
    host_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(16), nullable=False, default=STATUS_WAITING, index=True)
    scheduled_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    started_at = db.Column(db.DateTime, nullable=True)
    ended_at = db.Column(db.DateTime, nullable=True)

    host = db.relationship("User", back_populates="meetings", foreign_keys=[host_id])
    participants = db.relationship(
        "Participant", back_populates="meeting", lazy="dynamic", cascade="all, delete-orphan"
    )
    messages = db.relationship(
        "Message", back_populates="meeting", lazy="dynamic", cascade="all, delete-orphan"
    )
    recordings = db.relationship(
        "Recording", back_populates="meeting", lazy="dynamic", cascade="all, delete-orphan"
    )

    def set_password(self, raw_password: str | None) -> None:
        if raw_password:
            from werkzeug.security import generate_password_hash

            self.password_hash = generate_password_hash(raw_password)
        else:
            self.password_hash = None

    def check_password(self, raw_password: str) -> bool:
        if not self.password_hash:
            return True
        from werkzeug.security import check_password_hash

        return check_password_hash(self.password_hash, raw_password)

    @property
    def has_password(self) -> bool:
        return bool(self.password_hash)

    def to_dict(self, include_host: bool = True) -> dict:
        data = {
            "id": self.id,
            "meeting_code": self.meeting_code,
            "title": self.title,
            "host_id": self.host_id,
            "status": self.status,
            "has_password": self.has_password,
            "scheduled_at": iso_utc(self.scheduled_at),
            "created_at": iso_utc(self.created_at),
            "started_at": iso_utc(self.started_at),
            "ended_at": iso_utc(self.ended_at),
        }
        if include_host:
            data["host_name"] = self.host.name if self.host else None
        return data

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Meeting {self.id} {self.meeting_code}>"
