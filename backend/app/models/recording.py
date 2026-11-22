"""Recording model.

ConnectMeet does NOT implement cloud recording: Agora Cloud Recording and any
object-storage upload path are paid services, which this project must not use.

This table therefore only tracks *local* recording sessions — files produced by
the browser MediaRecorder API and saved on the participant's own device.
`recording_url` stays NULL because the file never leaves that device.
"""

from datetime import datetime, timezone

from ..extensions import db

STATUS_LOCAL = "local_device"
STATUS_FAILED = "failed"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Recording(db.Model):
    __tablename__ = "recordings"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    meeting_id = db.Column(
        db.Integer, db.ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recording_url = db.Column(db.String(1024), nullable=True)  # always NULL on the free tier
    started_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    ended_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(24), nullable=False, default=STATUS_LOCAL)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    meeting = db.relationship("Meeting", back_populates="recordings")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "meeting_id": self.meeting_id,
            "recording_url": self.recording_url,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
        }

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Recording {self.id} {self.status}>"
