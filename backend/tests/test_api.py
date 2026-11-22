"""API smoke tests for ConnectMeet.

Run from the `backend` folder:

    .venv\\Scripts\\python.exe -m tests.test_api

Uses an in-memory SQLite database so no MySQL server is required. MySQL-specific
behaviour (charset, foreign keys, schema.sql) is covered separately by
`init_db.py` + a live integration run.
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


def run() -> int:
    print("\n=== AUTH ===")
    r = client.post("/api/auth/register", json={"name": "Ada Lovelace", "email": "ada@example.com", "password": "Password1"})
    check("register returns 201", r.status_code == 201, str(r.status_code))
    ada_token = json_of(r)["token"]

    r = client.post("/api/auth/register", json={"name": "Ada 2", "email": "ADA@example.com", "password": "Password1"})
    check("duplicate email rejected (case-insensitive)", r.status_code == 409, str(r.status_code))

    r = client.post("/api/auth/register", json={"name": "Bad", "email": "nope", "password": "short"})
    check("registration validation errors", r.status_code == 422 and "errors" in json_of(r))

    r = client.post("/api/auth/login", json={"email": "ada@example.com", "password": "Password1"})
    check("login succeeds", r.status_code == 200 and "token" in json_of(r))
    ada_token = json_of(r)["token"]

    r = client.post("/api/auth/login", json={"email": "ada@example.com", "password": "WrongPass1"})
    check("wrong password rejected", r.status_code == 401, str(r.status_code))

    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {ada_token}"})
    check("GET /auth/me returns the user", r.status_code == 200 and json_of(r)["user"]["email"] == "ada@example.com")

    r = client.get("/api/auth/me")
    check("protected route rejects missing token", r.status_code == 401)

    print("\n=== MEETINGS ===")
    h = {"Authorization": f"Bearer {ada_token}"}
    r = client.post("/api/meetings", json={"title": "Sprint planning"}, headers=h)
    check("create meeting", r.status_code == 201, str(r.status_code))
    meeting = json_of(r)["meeting"]
    check("unique meeting code generated", meeting["meeting_code"] and len(meeting["meeting_code"]) >= 10, meeting["meeting_code"])
    mid = meeting["id"]

    r = client.post("/api/meetings", json={"title": ""}, headers=h)
    check("empty title rejected", r.status_code == 422)

    r = client.post("/api/auth/register", json={"name": "Bob Builder", "email": "bob@example.com", "password": "Password1"})
    bob_token = json_of(r)["token"]
    hb = {"Authorization": f"Bearer {bob_token}"}

    r = client.get(f"/api/meetings/code/{meeting['meeting_code']}", headers=hb)
    check("resolve meeting code", r.status_code == 200 and json_of(r)["meeting"]["id"] == mid)

    r = client.get(f"/api/meetings/code/ZZZZZ-ZZZZZ", headers=hb)
    check("unknown code -> 404", r.status_code == 404)

    r = client.get(f"/api/meetings/{mid}", headers=hb)
    check("non-participant cannot read meeting detail", r.status_code == 403, str(r.status_code))

    r = client.post(f"/api/meetings/{mid}/join", json={}, headers=hb)
    check("bob joins the meeting", r.status_code == 200 and json_of(r)["you"]["role"] == "participant")

    r = client.get(f"/api/meetings/{mid}", headers=hb)
    check("participant can read meeting detail", r.status_code == 200 and json_of(r)["you"]["status"] == "active")

    r = client.post(f"/api/meetings/{mid}/end", json={}, headers=hb)
    check("non-host cannot end the meeting", r.status_code == 403)

    r = client.post(f"/api/meetings/{mid}/leave", json={}, headers=hb)
    check("bob leaves", r.status_code == 200)

    # Password-protected meeting
    r = client.post("/api/meetings", json={"title": "Private room", "password": "secret"}, headers=h)
    priv = json_of(r)["meeting"]
    r = client.post(f"/api/meetings/{priv['id']}/join", json={"password": "wrong"}, headers=hb)
    check("wrong meeting password rejected", r.status_code == 401, str(r.status_code))
    r = client.post(f"/api/meetings/{priv['id']}/join", json={"password": "secret"}, headers=hb)
    check("correct meeting password accepted", r.status_code == 200, str(r.status_code))

    print("\n=== AGORA TOKEN ===")
    r = client.post("/api/agora/token", json={"meetingId": mid, "channel": str(mid)}, headers=hb)
    body = json_of(r)
    check("token issued for channel = meeting id", r.status_code == 200, str(r.status_code))
    check("rtc token starts with 006", body.get("rtcToken", "").startswith("006"))
    check("rtm token starts with 006", body.get("rtmToken", "").startswith("006"))
    check("app certificate is not exposed", "certificate" not in str(body).lower() or "certificateSet" in str(body))
    check("token uid equals user id", body.get("uid") == json_of(client.get('/api/auth/me', headers=hb))["user"]["id"])

    r = client.post("/api/agora/token", json={"meetingId": mid, "channel": "someone-elses-channel"}, headers=hb)
    check("foreign channel rejected", r.status_code == 400)

    r = client.post("/api/agora/token", json={"meetingId": mid, "channel": str(mid)}, headers={"Authorization": "Bearer bad"})
    check("bad token rejected", r.status_code == 401)

    print("\n=== CHAT ===")
    r = client.post(f"/api/meetings/{mid}/messages", json={"message": "Hello team!"}, headers=hb)
    check("send message", r.status_code == 201 and json_of(r)["message"]["sender_name"] == "Bob Builder")

    r = client.get(f"/api/meetings/{mid}/messages", headers=hb)
    check("history readable by participant", r.status_code == 200 and len(json_of(r)["messages"]) >= 1)

    r = client.post(f"/api/meetings/{mid}/messages", json={"message": "   "}, headers=hb)
    check("empty message rejected", r.status_code == 422)

    # Unauthorized chat access: Carol never joined.
    r = client.post("/api/auth/register", json={"name": "Carol", "email": "carol@example.com", "password": "Password1"})
    hc = {"Authorization": f"Bearer {json_of(r)['token']}"}
    r = client.get(f"/api/meetings/{mid}/messages", headers=hc)
    check("outsider cannot read chat history", r.status_code == 403, str(r.status_code))
    r = client.post(f"/api/meetings/{mid}/messages", json={"message": "hi"}, headers=hc)
    check("outsider cannot post to chat", r.status_code == 403, str(r.status_code))

    print("\n=== PARTICIPANT MANAGEMENT / END ===")
    # Bob must be an active participant to be removed by the host.
    r = client.post(f"/api/meetings/{mid}/join", json={}, headers=hb)
    check("bob rejoins before removal", r.status_code == 200, str(r.status_code))

    r = client.delete(f"/api/meetings/{mid}/participants/{json_of(client.get('/api/auth/me', headers=hb))['user']['id']}", headers=h)
    check("host can remove a participant", r.status_code == 200, str(r.status_code))

    r = client.post(f"/api/meetings/{mid}/join", json={}, headers=hb)
    check("removed participant cannot rejoin", r.status_code == 403, str(r.status_code))

    r = client.post(f"/api/meetings/{mid}/end", json={}, headers=h)
    check("host ends the meeting", r.status_code == 200 and json_of(r)["meeting"]["status"] == "ended")

    r = client.post(f"/api/meetings/{mid}/join", json={}, headers=h)
    check("cannot join an ended meeting", r.status_code == 410, str(r.status_code))

    print("\n=== HISTORY / DASHBOARD / PROFILE ===")
    r = client.get("/api/meetings/history", headers=h)
    check("history returns rows", r.status_code == 200 and len(json_of(r)["meetings"]) >= 2)

    r = client.get("/api/meetings?scope=stats", headers=h)
    stats = json_of(r)["stats"]
    check("stats are real numbers", r.status_code == 200 and stats["hosted"] >= 1, str(stats))

    r = client.get("/api/meetings?scope=dashboard", headers=h)
    check("dashboard lists", r.status_code == 200 and "upcoming" in json_of(r) and "recent" in json_of(r))

    r = client.get("/api/profile", headers=h)
    check("get profile", r.status_code == 200)

    r = client.put("/api/profile", json={"name": "Ada L."}, headers=h)
    check("update profile", r.status_code == 200 and json_of(r)["user"]["name"] == "Ada L.")

    r = client.post("/api/profile/change-password", json={"current_password": "nope", "new_password": "NewPass123"}, headers=h)
    check("wrong current password rejected", r.status_code == 401)

    r = client.post("/api/profile/change-password", json={"current_password": "Password1", "new_password": "NewPass123"}, headers=h)
    check("change password", r.status_code == 200, str(r.status_code))

    r = client.post("/api/auth/login", json={"email": "ada@example.com", "password": "NewPass123"})
    check("login works with the new password", r.status_code == 200)

    print("\n=== HEALTH ===")
    r = client.get("/api/health")
    body = json_of(r)
    check("health endpoint", r.status_code == 200 and body["status"] == "ok")
    check("agora health hides the certificate", body["agora"]["certificateSet"] is True and "fedcba" not in str(body))

    r = client.post("/api/auth/logout", headers=h)
    check("logout endpoint", r.status_code == 200)

    print(f"\n{'=' * 46}\nRESULT: {PASS} passed, {FAIL} failed\n")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    with app.app_context():
        sys.exit(run())
