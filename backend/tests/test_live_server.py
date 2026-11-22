"""End-to-end HTTP check against a RUNNING backend (default http://127.0.0.1:5001).

Exercises the exact same endpoints the React app uses, over real HTTP, and
verifies that data lands in MySQL.

    python tests/test_live_server.py [base_url]

The default port follows PORT in backend/.env (5001 for local development).
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

PORT = os.getenv("PORT", "5001")
BASE = sys.argv[1] if len(sys.argv) > 1 else f"http://127.0.0.1:{PORT}"

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


def call(method: str, path: str, body: dict | None = None, token: str | None = None):
    """Return (status, payload) for an API call."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            return exc.code, json.loads(raw)
        except Exception:  # noqa: BLE001
            return exc.code, {"message": raw[:200]}
    except Exception as exc:  # noqa: BLE001
        return 0, {"message": str(exc)}


def run() -> int:
    print(f"\n=== LIVE SERVER: {BASE} ===")

    status, health = call("GET", "/api/health")
    check("health endpoint", status == 200 and health.get("database") == "up", str(health))
    check(
        "health exposes no secret material",
        set(health.get("agora", {})).issubset({"configured", "appId", "certificateSet", "error"})
        and isinstance(health.get("agora", {}).get("certificateSet"), bool),
        str(health.get("agora")),
    )

    email = f"live.{int(__import__('time').time())}@example.com"
    status, body = call("POST", "/api/auth/register", {"name": "Live Test", "email": email, "password": "Password1"})
    check("register over HTTP", status == 201 and "token" in body, f"{status} {body}")
    token = body.get("token")

    status, body = call("POST", "/api/auth/login", {"email": email, "password": "Password1"})
    check("login over HTTP", status == 200 and "token" in body, str(status))
    token = body.get("token", token)

    status, body = call("GET", "/api/auth/me", token=token)
    check("GET /auth/me over HTTP", status == 200 and body["user"]["email"] == email, str(status))

    status, body = call("POST", "/api/meetings", {"title": "Live room"}, token=token)
    check("create meeting over HTTP", status == 201, f"{status} {body}")
    meeting = body["meeting"]
    mid = meeting["id"]

    status, body = call("POST", f"/api/meetings/{mid}/join", {}, token=token)
    check("join meeting over HTTP", status == 200 and body["you"]["status"] == "active", str(status))

    status, body = call("POST", f"/api/meetings/{mid}/messages", {"message": "live http message"}, token=token)
    check("chat message over HTTP", status == 201, f"{status} {body}")

    status, body = call("GET", f"/api/meetings/{mid}/messages", token=token)
    check(
        "chat history contains the message",
        status == 200 and any(m["message"] == "live http message" for m in body["messages"]),
        str(status),
    )

    status, body = call("POST", "/api/agora/token", {"meetingId": mid, "channel": str(mid)}, token=token)
    if status == 200:
        check("agora token issued (credentials configured)", body.get("rtcToken", "").startswith("006"))
        check("agora response has no certificate", "certificate" not in json.dumps(body).lower() or "certificateSet" in json.dumps(body))
    else:
        check(
            "agora returns a clear 503 when unconfigured",
            status == 503 and body.get("code") == "agora_not_configured",
            f"{status} {body}",
        )

    status, body = call("GET", "/api/meetings/history", token=token)
    check("history over HTTP", status == 200 and len(body["meetings"]) >= 1, str(status))

    status, body = call("GET", "/api/meetings/history")
    check("history requires auth", status == 401, str(status))

    status, body = call("POST", "/api/meetings", {"title": "x"})
    check("creating without a token is rejected", status == 401, str(status))

    print(f"\n{'=' * 46}\nRESULT: {PASS} passed, {FAIL} failed\n")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(run())
