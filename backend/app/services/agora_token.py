"""Agora legacy AccessToken (v1) implementation.

Ported line-for-line from Agora's official reference implementation:
https://github.com/AgoraIO/Tools/blob/master/DynamicKey/AgoraDynamicKey/python3/src/AccessToken.py

Agora does not publish this token builder to PyPI (verified: no
`agora-token`, `aora-token` or `agora-access-token` distribution exists), so the
small, well-documented algorithm is vendored here. The Agora App Certificate is
only ever read from the environment — it is never sent to the browser.

Token layout (all little-endian):
    "006" + appID + base64( signature | crc(channel) | crc(uid) | messages )
where signature = HMAC-SHA256(appCertificate, appID + channel + uid + messages)
"""

from __future__ import annotations

import base64
import hmac
import secrets
import struct
import time
from collections import OrderedDict
from hashlib import sha256
from zlib import crc32

# Privilege keys
K_JOIN_CHANNEL = 1
K_PUBLISH_AUDIO_STREAM = 2
K_PUBLISH_VIDEO_STREAM = 3
K_PUBLISH_DATA_STREAM = 4
K_RTM_LOGIN = 1000

# Roles for the RTC builder
ROLE_ATTENDEE = 0
ROLE_PUBLISHER = 1
ROLE_SUBSCRIBER = 2
ROLE_ADMIN = 101

VERSION = "006"


def _pack_uint16(value: int) -> bytes:
    return struct.pack("<H", int(value))


def _pack_uint32(value: int) -> bytes:
    return struct.pack("<I", int(value))


def _pack_string(value: str | bytes) -> bytes:
    raw = value.encode("utf-8") if isinstance(value, str) else value
    return _pack_uint16(len(raw)) + raw


def _pack_map_uint32(mapping: dict[int, int]) -> bytes:
    out = _pack_uint16(len(mapping))
    for key, value in mapping.items():
        out += _pack_uint16(key) + _pack_uint32(value)
    return out


class AccessToken:
    """Builds (and can parse) an Agora legacy access token."""

    def __init__(self, app_id: str = "", app_certificate: str = "", channel_name: str = "", uid: str = ""):
        self.app_id = app_id
        self.app_certificate = app_certificate
        self.channel_name = channel_name
        self.ts = int(time.time()) + 24 * 3600
        self.salt = secrets.SystemRandom().randint(1, 99999999)
        self.messages: dict[int, int] = {}
        # uid 0 / empty means "let the SDK assign a uid"
        self.uid_str = "" if uid in (0, "0", None) else str(uid)

    def add_privilege(self, privilege: int, expire_timestamp: int) -> None:
        self.messages[privilege] = expire_timestamp

    def build(self) -> str:
        messages = OrderedDict(sorted(self.messages.items(), key=lambda item: int(item[0])))
        packed = _pack_uint32(self.salt) + _pack_uint32(self.ts) + _pack_map_uint32(messages)

        signing_input = (
            self.app_id.encode("utf-8")
            + self.channel_name.encode("utf-8")
            + self.uid_str.encode("utf-8")
            + packed
        )
        signature = hmac.new(self.app_certificate.encode("utf-8"), signing_input, sha256).digest()
        crc_channel = crc32(self.channel_name.encode("utf-8")) & 0xFFFFFFFF
        crc_uid = crc32(self.uid_str.encode("utf-8")) & 0xFFFFFFFF

        content = (
            _pack_string(signature)
            + _pack_uint32(crc_channel)
            + _pack_uint32(crc_uid)
            + _pack_string(packed)
        )
        return VERSION + self.app_id + base64.b64encode(content).decode("utf-8")

    def parse(self, token: str) -> bool:
        """Round-trip parser used by the unit tests to validate a token."""
        try:
            if token[:3] != VERSION:
                return False
            app_id = token[3:35]
            content = base64.b64decode(token[35:])
            pos = 0

            sig_len = struct.unpack("<H", content[pos : pos + 2])[0]
            pos += 2
            pos += sig_len
            pos += 4  # crc channel name
            pos += 4  # crc uid
            msg_len = struct.unpack("<H", content[pos : pos + 2])[0]
            pos += 2
            packed = content[pos : pos + msg_len]

            self.salt = struct.unpack("<I", packed[0:4])[0]
            self.ts = struct.unpack("<I", packed[4:8])[0]
            count = struct.unpack("<H", packed[8:10])[0]
            cursor = 10
            self.messages = {}
            for _ in range(count):
                key = struct.unpack("<H", packed[cursor : cursor + 2])[0]
                cursor += 2
                value = struct.unpack("<I", packed[cursor : cursor + 4])[0]
                cursor += 4
                self.messages[key] = value
            self.app_id = app_id
            return True
        except Exception:  # noqa: BLE001 - parsing is best-effort validation
            return False


def build_rtc_token(
    app_id: str,
    app_certificate: str,
    channel_name: str,
    uid: int | str,
    role: int,
    privilege_expire_ts: int,
) -> str:
    """RTC token. `role` decides whether publish privileges are granted."""
    token = AccessToken(app_id, app_certificate, channel_name, uid)
    token.add_privilege(K_JOIN_CHANNEL, privilege_expire_ts)
    if role in (ROLE_ATTENDEE, ROLE_ADMIN, ROLE_PUBLISHER):
        token.add_privilege(K_PUBLISH_VIDEO_STREAM, privilege_expire_ts)
        token.add_privilege(K_PUBLISH_AUDIO_STREAM, privilege_expire_ts)
        token.add_privilege(K_PUBLISH_DATA_STREAM, privilege_expire_ts)
    return token.build()


def build_rtm_token(
    app_id: str, app_certificate: str, user_account: str, privilege_expire_ts: int
) -> str:
    """RTM login token. `user_account` must equal the RTM uid used at login."""
    token = AccessToken(app_id, app_certificate, user_account, "")
    token.add_privilege(K_RTM_LOGIN, privilege_expire_ts)
    return token.build()
