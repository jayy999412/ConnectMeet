"""Timestamp serialization tests — every datetime must carry a UTC offset.

Run from the `backend` folder:

    .venv\\Scripts\\python.exe -m tests.test_timestamps

Why this exists: MySQL DATETIME stores naive UTC. A bare isoformat() emits
``2026-11-24T06:22:00`` which JavaScript reads as the *viewer's* local time,
so chat showed 06:22 AM instead of the real local time. Every API datetime
must end with ``+00:00`` so browsers convert correctly.
"""

from __future__ import annotations

import os
import re
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["FLASK_ENV"] = "testing"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["CREATE_TABLES_ON_START"] = "1"
os.environ["RATE_LIMIT_ENABLED"] = "0"
os.environ["AGORA_APP_ID"] = "0123456789abcdef0123456789abcdef"
os.environ["AGORA_APP_CERTIFICATE"] = "fedcba9876543210fedcba9876543210"

from app import create_app  # noqa: E402
from app.utils.timefmt import iso_utc  # noqa: E402

app = create_app("testing")
client = app.test_client()

PASS = 0
FAIL = 0

OFFSET_RE = re.compile(r"(Z|[+-]\d{2}:\d{2})$")
# Fields that must never be a bare local-looking string.
DATETIME_FIELDS = (
    "created_at",
    "updated_at",
    "started_at",
    "ended_at",
    "joined_at",
    "left_at",
    "scheduled_at",
)


def check(name: str, condition: bool, detail: str = "") -> None:
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL += 1
        print(f"  FAIL  {name} {detail}")


def json_of(response):
    return response.get_json() or {}


def assert_offset(name: str, value) -> None:
    check(name, isinstance(value, str) and bool(OFFSET_RE.search(value)), f"got {value!r}")


def walk_offsets(prefix: str, payload) -> None:
    """Recursively assert every datetime-looking field carries an offset."""
    if isinstance(payload, dict):
        for key, value in payload.items():
            if key in DATETIME_FIELDS and value is not None:
                assert_offset(f"{prefix}.{key} has UTC offset", value)
            else:
                walk_offsets(f"{prefix}.{key}", value)
    elif isinstance(payload, list):
        for i, item in enumerate(payload):
            walk_offsets(f"{prefix}[{i}]", item)


def run() -> int:
    print("\n=== TIMESTAMPS: every API datetime carries a UTC offset ===")

    # ---- helper unit checks ---------------------------------------------
    naive = datetime(2026, 11, 24, 6, 22, 0)
    assert_offset("iso_utc adds +00:00 to naive UTC", iso_utc(naive))
    aware = datetime(2026, 11, 24, 11, 52, 0, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    check(
        "iso_utc converts aware values to UTC",
        iso_utc(aware) == "2026-11-24T06:22:00+00:00",
        f"got {iso_utc(aware)!r}",
    )
    check("iso_utc(None) is None", iso_utc(None) is None)

    # ---- auth ------------------------------------------------------------
    r = client.post(
        "/api/auth/register",
        json={"name": "Time Test", "email": "time.test@example.com", "password": "Password1"},
    )
    check("register", r.status_code == 201, str(r.status_code))
    headers = {"Authorization": f"Bearer {json_of(r)['token']}"}
    walk_offsets("register", json_of(r))

    r = client.get("/api/auth/me", headers=headers)
    walk_offsets("auth.me", json_of(r))

    # ---- meeting + scheduled meeting -------------------------------------
    r = client.post("/api/meetings", json={"title": "Timing check"}, headers=headers)
    check("create meeting", r.status_code == 201, str(r.status_code))
    meeting = json_of(r)["meeting"]
    mid = meeting["id"]
    walk_offsets("meeting.create", json_of(r))

    soon = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    r = client.post(
        "/api/meetings", json={"title": "Future meeting", "scheduled_at": soon}, headers=headers
    )
    check("create scheduled meeting", r.status_code == 201, str(r.status_code))
    smid = json_of(r)["meeting"]["id"]
    walk_offsets("meeting.scheduled", json_of(r))

    # scheduled meeting in the future must be rejected cleanly (409, not 500)
    r = client.post(f"/api/meetings/{smid}/join", headers=headers)
    check(
        "future scheduled meeting blocks join with 409 (not 500)",
        r.status_code == 409,
        str(r.status_code),
    )

    # resolve (public endpoint)
    r = client.get(f"/api/meetings/code/{meeting['meeting_code']}")
    walk_offsets("meeting.resolve", json_of(r))

    # ---- chat message (the exact field from the bug report) ---------------
    r = client.post(
        f"/api/meetings/{mid}/messages", json={"message": "timestamp probe"}, headers=headers
    )
    check("send message", r.status_code == 201, str(r.status_code))
    created = json_of(r)["message"]["created_at"]
    assert_offset("chat message created_at has UTC offset", created)
    # The stored value must be actual UTC (within 2 minutes of now UTC)
    parsed = datetime.fromisoformat(created)
    drift = abs((parsed.astimezone(timezone.utc) - datetime.now(timezone.utc)).total_seconds())
    check("chat timestamp is real UTC (drift < 120s)", drift < 120, f"drift={drift}s")

    r = client.get(f"/api/meetings/{mid}/messages", headers=headers)
    walk_offsets("chat.history", json_of(r))

    # ---- participants / history / dashboard ------------------------------
    r = client.get(f"/api/meetings/{mid}/participants", headers=headers)
    walk_offsets("participants", json_of(r))

    r = client.get("/api/meetings/history", headers=headers)
    check("history", r.status_code == 200, str(r.status_code))
    walk_offsets("history", json_of(r))

    r = client.get("/api/meetings?scope=all", headers=headers)
    walk_offsets("list", json_of(r))

    r = client.post(f"/api/meetings/{mid}/leave", headers=headers)
    walk_offsets("leave", json_of(r))

    r = client.get("/api/profile", headers=headers)
    walk_offsets("profile", json_of(r))

    print(f"\nRESULT: {PASS} passed, {FAIL} failed")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(run())
