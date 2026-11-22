"""Live end-to-end check of meeting access rules against the RUNNING server.

    python tests/test_access_rules.py [base_url]

Covers what a user actually experiences when joining:
  * wrong password rejected, right password accepted
  * only the host can end the meeting
  * a removed participant cannot rejoin
  * nobody can join a meeting that already ended
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

PORT = os.getenv("PORT", "5001")
BASE = sys.argv[1] if len(sys.argv) > 1 else f"http://127.0.0.1:{PORT}"

PASS = 0
FAIL = 0


def call(path, method="GET", data=None, token=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(BASE + path, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, json.loads(exc.read().decode() or "{}")
        except Exception:
            return exc.code, {}
    except Exception as exc:  # noqa: BLE001
        return 0, {"message": str(exc)}


def check(label, ok, detail=""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  PASS  {label}")
    else:
        FAIL += 1
        print(f"  FAIL  {label} {detail}")


def main():
    print(f"\n=== ACCESS RULES vs {BASE} ===")
    stamp = int(time.time())

    # --- three real users -------------------------------------------------
    tokens = {}
    for name in ("host", "guest", "outsider"):
        email = f"access.{name}.{stamp}@example.com"
        status, body = call(
            "/api/auth/register",
            "POST",
            {"name": name.title(), "email": email, "password": "Password1"},
        )
        check(f"register {name}", status in (200, 201), body)
        tokens[name] = body.get("token")
    host, guest, outsider = (tokens[k] for k in ("host", "guest", "outsider"))

    # --- password-protected meeting --------------------------------------
    status, body = call(
        "/api/meetings",
        "POST",
        {"title": "Access rules test", "password": "S3cret!"},
        token=host,
    )
    check("host creates password-protected meeting", status in (200, 201), body)
    mid = body.get("meeting", {}).get("id")
    code = body.get("meeting", {}).get("meeting_code")
    check("meeting id present", bool(mid), body)

    # wrong password
    status, body = call(f"/api/meetings/{mid}/join", "POST", {"password": "wrong"}, token=guest)
    check("wrong password rejected (401)", status == 401, f"got {status} {body}")

    # no password at all
    status, body = call(f"/api/meetings/{mid}/join", "POST", {}, token=guest)
    check("missing password rejected (401)", status == 401, f"got {status} {body}")

    # right password
    status, body = call(f"/api/meetings/{mid}/join", "POST", {"password": "S3cret!"}, token=guest)
    check("correct password joins", status == 200, f"got {status} {body}")
    check("guest role is participant", body.get("you", {}).get("role") == "participant", body)

    # code lookup works for the join page
    status, body = call("/api/meetings", "GET", token=guest)
    check("meeting list works", status == 200, f"got {status}")

    # --- host permissions -------------------------------------------------
    status, body = call(f"/api/meetings/{mid}/end", "POST", {}, token=guest)
    check("non-host cannot end meeting (403)", status == 403, f"got {status} {body}")

    # outsider never joined -> cannot end either
    status, body = call(f"/api/meetings/{mid}/end", "POST", {}, token=outsider)
    check("outsider cannot end meeting (403)", status == 403, f"got {status} {body}")

    # --- removal ----------------------------------------------------------
    guest_id = None
    status, body = call(f"/api/meetings/{mid}", token=host)
    for p in body.get("participants", []):
        if p.get("role") != "host":
            guest_id = p.get("user_id")
    check("host sees guest participant", bool(guest_id), body)

    status, body = call(f"/api/meetings/{mid}/participants/{guest_id}", "DELETE",
                        {}, token=host)
    check("host removes guest", status == 200, f"got {status} {body}")

    status, body = call(f"/api/meetings/{mid}/join", "POST", {"password": "S3cret!"}, token=guest)
    check("removed guest cannot rejoin (403)", status == 403, f"got {status} {body}")

    # --- end for everyone -------------------------------------------------
    status, body = call(f"/api/meetings/{mid}/end", "POST", {}, token=host)
    check("host ends the meeting", status == 200, f"got {status} {body}")
    check("status is ended", body.get("meeting", {}).get("status") == "ended", body)

    status, body = call(f"/api/meetings/{mid}/join", "POST", {}, token=host)
    check("nobody can join an ended meeting (410)", status == 410, f"got {status} {body}")

    # chat after end must be refused
    status, body = call(f"/api/meetings/{mid}/messages", "POST", {"message": "late"}, token=host)
    check("cannot chat after meeting ended", status in (400, 403, 409, 410),
          f"got {status} {body}")

    print(f"\nRESULT: {PASS} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
