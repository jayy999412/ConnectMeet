"""Unit tests for the vendored Agora token builder.

The builder itself was cross-validated byte-for-byte against Agora's official
Node implementation (`agora-access-token@2.0.4`) using a pinned salt/timestamp —
see `backend/tests/crosscheck/`. These tests guard the format and round-trip
behaviour so refactors cannot silently break token generation.

Run from the `backend` folder:

    .venv\\Scripts\\python.exe -m tests.test_agora_token
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.agora_token import (  # noqa: E402
    K_JOIN_CHANNEL,
    K_PUBLISH_AUDIO_STREAM,
    K_PUBLISH_DATA_STREAM,
    K_PUBLISH_VIDEO_STREAM,
    K_RTM_LOGIN,
    ROLE_PUBLISHER,
    ROLE_SUBSCRIBER,
    AccessToken,
    build_rtc_token,
    build_rtm_token,
)

APP_ID = "0123456789abcdef0123456789abcdef"
CERT = "fedcba9876543210fedcba9876543210"

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


def run() -> int:
    print("\n=== AGORA TOKEN BUILDER ===")

    token = build_rtc_token(APP_ID, CERT, "12345", 42, ROLE_PUBLISHER, 1900000000)
    check("rtc token starts with version 006", token.startswith("006"))
    check("rtc token embeds the app id", token[3:35] == APP_ID, token[3:35])
    check("rtc token length is sane", 100 < len(token) < 400, str(len(token)))

    parsed = AccessToken()
    check("rtc token parses back", parsed.parse(token))
    check("join privilege present", K_JOIN_CHANNEL in parsed.messages)
    check("publish privileges present for publisher", all(
        k in parsed.messages for k in (K_PUBLISH_AUDIO_STREAM, K_PUBLISH_VIDEO_STREAM, K_PUBLISH_DATA_STREAM)
    ))
    check("privilege expiry respected", parsed.messages[K_JOIN_CHANNEL] == 1900000000)

    sub = build_rtc_token(APP_ID, CERT, "12345", 42, ROLE_SUBSCRIBER, 1900000000)
    parsed_sub = AccessToken()
    parsed_sub.parse(sub)
    check(
        "subscriber role has no publish privileges",
        K_PUBLISH_VIDEO_STREAM not in parsed_sub.messages,
    )

    rtm = build_rtm_token(APP_ID, CERT, "42", 1900000000)
    parsed_rtm = AccessToken()
    check("rtm token parses", parsed_rtm.parse(rtm))
    check("rtm login privilege present", K_RTM_LOGIN in parsed_rtm.messages)

    # Determinism: same inputs (salt/ts pinned) must give the same signature.
    a = AccessToken(APP_ID, CERT, "chan", "7")
    a.salt, a.ts = 1, 2
    a.add_privilege(K_JOIN_CHANNEL, 100)
    b = AccessToken(APP_ID, CERT, "chan", "7")
    b.salt, b.ts = 1, 2
    b.add_privilege(K_JOIN_CHANNEL, 100)
    check("deterministic for pinned salt/ts", a.build() == b.build())

    # A different certificate must produce a different signature.
    c = AccessToken(APP_ID, "0" * 32, "chan", "7")
    c.salt, c.ts = 1, 2
    c.add_privilege(K_JOIN_CHANNEL, 100)
    check("signature depends on the certificate", a.build() != c.build())

    # uid 0 must be encoded as an empty account (Agora convention).
    d = AccessToken(APP_ID, CERT, "chan", 0)
    check("uid 0 encodes to an empty account", d.uid_str == "")

    print(f"\n{'=' * 46}\nRESULT: {PASS} passed, {FAIL} failed\n")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(run())
