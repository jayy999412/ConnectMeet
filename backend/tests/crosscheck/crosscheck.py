"""Build the SAME tokens as verify.js with our vendored Python implementation."""
import json
import sys

sys.path.insert(0, r"C:\VideoConferenceMeet\backend")

from app.services.agora_token import (
    K_JOIN_CHANNEL,
    K_PUBLISH_AUDIO_STREAM,
    K_PUBLISH_DATA_STREAM,
    K_PUBLISH_VIDEO_STREAM,
    K_RTM_LOGIN,
    AccessToken,
)

APP_ID = "0123456789abcdef0123456789abcdef"
CERT = "fedcba9876543210fedcba9876543210"
CHANNEL = "12345"
UID = 42
EXPIRE = 1900000000
SALT = 2147483647
TS = 1700000000 + 86400

rtc = AccessToken(APP_ID, CERT, CHANNEL, str(UID))
for key in (K_JOIN_CHANNEL, K_PUBLISH_AUDIO_STREAM, K_PUBLISH_VIDEO_STREAM, K_PUBLISH_DATA_STREAM):
    rtc.add_privilege(key, EXPIRE)
rtc.salt = SALT
rtc.ts = TS

rtm = AccessToken(APP_ID, CERT, str(UID), "")
rtm.add_privilege(K_RTM_LOGIN, EXPIRE)
rtm.salt = SALT
rtm.ts = TS

print(json.dumps({"salt": SALT, "ts": TS, "rtc": rtc.build(), "rtm": rtm.build()}))
