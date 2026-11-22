"""User model — accounts and authentication identity."""

from datetime import datetime, timezone

from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    profile_image = db.Column(db.String(512), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    # Relationships -------------------------------------------------------
    meetings = db.relationship(
        "Meeting", back_populates="host", lazy="dynamic", foreign_keys="Meeting.host_id"
    )
    participants = db.relationship("Participant", back_populates="user", lazy="dynamic")
    messages = db.relationship("Message", back_populates="sender", lazy="dynamic")

    def set_password(self, raw_password: str) -> None:
        """Hash with Werkzeug's PBKDF2/scrypt — never store plain text."""
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password_hash(self.password_hash, raw_password)

    def to_dict(self, include_email: bool = True) -> dict:
        data = {
            "id": self.id,
            "name": self.name,
            "profile_image": self.profile_image,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_email:
            data["email"] = self.email
        return data

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<User {self.id} {self.email}>"
