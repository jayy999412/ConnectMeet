# Agora token cross-validation

The ConnectMeet backend does **not** use a third-party token package — none
exists on PyPI (verified: `agora-token`, `aora-token`, `agora-access-token`
and `agora_token` all return *no matching distribution*). Instead the ~90-line
Agora legacy `AccessToken` algorithm is vendored in
`app/services/agora_token.py`, ported from Agora's official reference:
<https://github.com/AgoraIO/Tools/tree/master/DynamicKey/AgoraDynamicKey/python3/src>

To prove the port is correct, `crosscheck.js` builds tokens with Agora's
**official Node implementation** (`agora-access-token@2.0.4`) using a pinned
salt/timestamp, and `crosscheck.py` builds the exact same tokens with the
vendored Python code. Both outputs must be identical, character for character.

## How to run it

```powershell
# 1. from a temp folder
mkdir $env:TEMP\agora-xcheck ; cd $env:TEMP\agora-xcheck
npm init -y
npm install agora-access-token

# 2. copy the two scripts from backend/tests/crosscheck/ into that folder

# 3. run both and compare
node crosscheck.js | ConvertFrom-Json | Format-List
C:\VideoConferenceMeet\backend\.venv\Scripts\python.exe crosscheck.py
```

## Verified result (2026-11-20)

```
JS salt=2147483647 ts=1700086400
PY salt=2147483647 ts=1700086400
RTC match: True
RTM match: True
```

Both the RTC and RTM tokens are byte-identical to Agora's official builder,
which is the strongest available check before real App credentials exist.
Once you add your own `AGORA_APP_ID` / `AGORA_APP_CERTIFICATE`, joining a real
channel from two browsers is the final end-to-end confirmation.
