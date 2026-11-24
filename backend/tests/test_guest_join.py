"""Guest-join tests — invite links must work for people with no account.

Run from the `backend` folder:

    .venv\\Scripts\\python.exe -m tests.test_guest_join

Covers the Zoom-style flow: open link -> type a name -> be in the room, plus
the security properties that must hold (no orphaned accounts on failure, no
host powers for guests, ended meetings still blocked).
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["FLASK_ENV"] = "testing"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["CREATE_TABLES_ON_START"] = "1"
os.environ["RATE_LIMIT_ENABLED"] = "0"
os.environ["AGORA_APP_ID"] = "0123456789abcdef0123456789abcdef"
os.environ["AGORA_APP_CERTIFICATE"] = "fedcba9876543210fedcba9876543210"

from app import create_app  # noqa: E402
from app.models import User  # noqa: E402

app = create_app("testing")
client = app.test_client()

PASS = 0
FAIL = 0


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


def user_count() -> int:
    with app.app_context():
        return User.query.count()


def run() -> int:
    print("\n=== GUEST JOIN: invite link without an account ===")

    # ---- setup: a host and a password-protected meeting ------------------
    r = client.post(
        "/api/auth/register",
        json={"name": "Host Person", "email": "host.guest@test.com", "password": "Password1"},
    )
    check("host registers", r.status_code == 201, str(r.status_code))
    host_headers = {"Authorization": f"Bearer {json_of(r)['token']}"}

    r = client.post(
        "/api/meetings",
        json={"title": "Guest gate test", "password": "S3cret!"},
        headers=host_headers,
    )
    check("host creates password-protected meeting", r.status_code == 201, str(r.status_code))
    meeting = json_of(r)["meeting"]
    mid = meeting["id"]
    code = meeting["meeting_code"]

    # ---- resolve must be public (the join page previews before any login) -
    r = client.get(f"/api/meetings/code/{code}")
    check("resolve works WITHOUT auth", r.status_code == 200, str(r.status_code))
    check(
        "resolve returns only safe fields",
        set(json_of(r).get("meeting", {}))
        <= {"id", "meeting_code", "title", "status", "has_password", "scheduled_at"},
        str(sorted(json_of(r).get("meeting", {}).keys())),
    )
    r = client.get("/api/meetings/code/ZZZZZ-ZZZZZ")
    check("unknown code still 404", r.status_code == 404, str(r.status_code))

    # ---- name validation --------------------------------------------------
    r = client.post(f"/api/meetings/{mid}/guest-join", json={"name": "X"})
    check("single-character name rejected (422)", r.status_code == 422, str(r.status_code))
    r = client.post(f"/api/meetings/{mid}/guest-join", json={"name": ""})
    check("empty name rejected (422)", r.status_code == 422, str(r.status_code))

    # ---- failures must not leave orphaned guest accounts -------------------
    before = user_count()
    r = client.post(
        f"/api/meetings/{mid}/guest-join", json={"name": "Wrong Pass", "password": "nope"}
    )
    check("wrong meeting password rejected (401)", r.status_code == 401, str(r.status_code))
    check("no orphaned guest after password failure", user_count() == before, f"before={before}")

    r = client.post(f"/api/meetings/{mid}/guest-join", json={"name": "Nobody Home"})
    check("missing password rejected (401)", r.status_code == 401, str(r.status_code))
    check("no orphaned guest after missing password", user_count() == before, f"before={before}")

    r = client.post("/api/meetings/999999/guest-join", json={"name": "Ghost"})
    check("unknown meeting id 404", r.status_code == 404, str(r.status_code))
    check("no orphaned guest after 404", user_count() == before, f"before={before}")

    # ---- the actual invite flow: name + password -> in the room -----------
    r = client.post(
        f"/api/meetings/{mid}/guest-join",
        json={"name": "Mobile Maya", "password": "S3cret!"},
    )
    check("guest joins with name + password (201)", r.status_code == 201, str(r.status_code))
    body = json_of(r)
    guest_token = body.get("token")
    guest_headers = {"Authorization": f"Bearer {guest_token}"}
    check("guest receives a session token", bool(guest_token))
    check("guest user flagged is_guest=true", body.get("user", {}).get("is_guest") is True)
    check("guest never receives a usable password", "password" not in json_of(r).get("user", {}))
    check(
        "guest recorded as active participant",
        body.get("participant", {}).get("status") == "active",
        str(body.get("participant")),
    )
    check(
        "guest role is participant, not host",
        body.get("you", {}).get("role") == "participant",
        str(body.get("you")),
    )
    check(
        "participant payload carries is_guest for the UI badge",
        body.get("participant", {}).get("is_guest") is True,
    )

    # ---- the guest token is a real, full session ---------------------------
    r = client.get("/api/auth/me", headers=guest_headers)
    check(
        "guest /auth/me works",
        r.status_code == 200 and json_of(r)["user"].get("is_guest") is True,
        str(r.status_code),
    )
    r = client.get(f"/api/meetings/{mid}", headers=guest_headers)
    check("guest can read meeting detail", r.status_code == 200, str(r.status_code))
    r = client.post("/api/agora/token", json={"meetingId": mid}, headers=guest_headers)
    check(
        "guest receives Agora RTC+RTM tokens",
        r.status_code == 200 and json_of(r).get("rtcToken") and json_of(r).get("rtmToken"),
        str(r.status_code),
    )
    r = client.post(
        f"/api/meetings/{mid}/messages",
        json={"message": "hello from a guest"},
        headers=guest_headers,
    )
    check("guest can send chat (201)", r.status_code == 201, str(r.status_code))
    r = client.get(f"/api/meetings/{mid}/messages", headers=guest_headers)
    check("guest can read chat", r.status_code == 200, str(r.status_code))
    r = client.get(f"/api/meetings/{mid}/participants", headers=guest_headers)
    check("guest can list participants", r.status_code == 200, str(r.status_code))
    r = client.post(f"/api/meetings/{mid}/leave", headers=guest_headers)
    check("guest can leave", r.status_code == 200, str(r.status_code))

    # ---- guests get NO host powers ----------------------------------------
    r = client.post(f"/api/meetings/{mid}/end", headers=guest_headers)
    check("guest cannot end the meeting (403)", r.status_code == 403, str(r.status_code))

    # ---- ended meetings stay closed to everyone ---------------------------
    r = client.post(f"/api/meetings/{mid}/end", headers=host_headers)
    check("host ends the meeting", r.status_code == 200, str(r.status_code))
    r = client.post(f"/api/meetings/{mid}/guest-join", json={"name": "Latecomer"})
    check("guest blocked from ended meeting (410)", r.status_code == 410, str(r.status_code))
    check(
        "no orphaned guest after 410",
        user_count() == before + 1,
        f"expected {before + 1}, got {user_count()}",
    )

    # ---- meetings without a password: name only, nothing else -------------
    r = client.post(
        "/api/meetings", json={"title": "Open meeting"}, headers=host_headers
    )
    check("host creates open meeting", r.status_code == 201, str(r.status_code))
    mid2 = json_of(r)["meeting"]["id"]

    r = client.post(f"/api/meetings/{mid2}/guest-join", json={"name": "Open Guest"})
    check("name-only join works (no password set)", r.status_code == 201, str(r.status_code))
    check("open guest gets a session", bool(json_of(r).get("token")))
    check(
        "open guest flagged is_guest",
        json_of(r).get("user", {}).get("is_guest") is True,
    )

    # ---- rejoining as the same guest (e.g. refresh) ------------------------
    open_headers = {"Authorization": f"Bearer {json_of(r)['token']}"}
    r = client.post(f"/api/meetings/{mid2}/guest-join", json={"name": "Open Guest"}, headers=open_headers)
    # Not required to succeed as "same user" — a fresh browser makes a fresh
    # guest — but it must never 500.
    check("repeat guest-join never crashes (2xx/4xx)", r.status_code < 500, str(r.status_code))
    r = client.get("/api/auth/me", headers=open_headers)
    check("guest session survives after rejoin attempt", r.status_code == 200, str(r.status_code))

    print(f"\nRESULT: {PASS} passed, {FAIL} failed")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(run())
