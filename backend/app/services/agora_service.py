"""Agora service — validates configuration and mints RTC/RTM tokens."""

from __future__ import annotations

import time

from flask import current_app

from .agora_token import ROLE_PUBLISHER, ROLE_SUBSCRIBER, build_rtc_token, build_rtm_token  # noqa: F401


class AgoraConfigError(RuntimeError):
    """Raised when Agora credentials are missing or malformed."""


def is_configured() -> bool:
    app_id = current_app.config.get("AGORA_APP_ID", "")
    certificate = current_app.config.get("AGORA_APP_CERTIFICATE", "")
    return bool(app_id and certificate and len(app_id) == 32)


def _credentials() -> tuple[str, str]:
    app_id = current_app.config.get("AGORA_APP_ID", "").strip()
    certificate = current_app.config.get("AGORA_APP_CERTIFICATE", "").strip()
    if not app_id or not certificate:
        raise AgoraConfigError(
            "Video calling is not configured. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE "
            "on the server (see README — 'Configuring Agora')."
        )
    if len(app_id) != 32:
        raise AgoraConfigError("AGORA_APP_ID must be a 32-character hex string.")
    return app_id, certificate


def build_tokens(
    *,
    channel: str,
    uid: int,
    role: str = "participant",
    rtc_ttl: int | None = None,
    rtm_ttl: int | None = None,
) -> dict:
    """Return fresh RTC + RTM tokens for an authorized user on `channel`."""
    app_id, certificate = _credentials()

    rtc_ttl = rtc_ttl or int(current_app.config.get("AGORA_RTC_TOKEN_TTL", 3600))
    rtm_ttl = rtm_ttl or int(current_app.config.get("AGORA_RTM_TOKEN_TTL", 3600))
    now = int(time.time())

    # The frontend joins Agora in "rtc" mode where every peer publishes media,
    # so both roles need publish privileges. Host/participant permissions
    # (removing people, ending the meeting) are enforced by this backend.
    agora_role = ROLE_PUBLISHER

    rtc_token = build_rtc_token(
        app_id,
        certificate,
        channel,
        uid,
        agora_role,
        now + rtc_ttl,
    )
    rtm_token = build_rtm_token(app_id, certificate, str(uid), now + rtm_ttl)

    return {
        "appId": app_id,
        "channel": channel,
        "uid": uid,
        "rtcToken": rtc_token,
        "rtmToken": rtm_token,
        "rtcExpireAt": now + rtc_ttl,
        "rtmExpireAt": now + rtm_ttl,
        "role": role,
    }


def health() -> dict:
    """Safe-to-expose configuration status (never includes the certificate)."""
    try:
        app_id, _ = _credentials()
        configured = True
        error = None
    except AgoraConfigError as exc:
        app_id = current_app.config.get("AGORA_APP_ID", "")
        configured = False
        error = str(exc)
    return {
        "configured": configured,
        "appId": app_id,
        "certificateSet": bool(current_app.config.get("AGORA_APP_CERTIFICATE")),
        "error": error,
    }


# Convenience re-export so routes can express intent clearly.
__all__ = [
    "AgoraConfigError",
    "build_tokens",
    "health",
    "is_configured",
    "ROLE_SUBSCRIBER",
]
