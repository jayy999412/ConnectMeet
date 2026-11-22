"""Quick read-only inspection of connectmeet_db (local dev helper).

    python inspect_db.py
"""

from __future__ import annotations

import os
import sys

import pymysql
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

url = os.getenv("DATABASE_URL", "")
# mysql+pymysql://user:pass@host:port/db
dsn = url.split("://", 1)[1]
creds, rest = dsn.rsplit("@", 1)
user, password = creds.split(":", 1)
hostport, database = rest.split("/", 1)
host, _, port = hostport.partition(":")

conn = pymysql.connect(
    host=user and host,
    port=int(port or 3306),
    user=user,
    password=password,
    database=database.split("?")[0],
    charset="utf8mb4",
    cursorclass=pymysql.cursors.DictCursor,
)

with conn.cursor() as cur:
    for label, sql in [
        ("users", "SELECT id, name, email, created_at FROM users ORDER BY id"),
        ("meetings", "SELECT id, meeting_code, title, host_id, status, started_at FROM meetings ORDER BY id"),
        ("participants", "SELECT id, meeting_id, user_id, role, status, joined_at, left_at FROM participants ORDER BY id"),
        ("messages", "SELECT id, meeting_id, sender_id, LEFT(message, 40) AS message FROM messages ORDER BY id"),
        ("recordings", "SELECT id, meeting_id, status, recording_url FROM recordings ORDER BY id"),
    ]:
        cur.execute(sql)
        rows = cur.fetchall()
        print(f"\n--- {label} ({len(rows)} rows) ---")
        for row in rows:
            print("   ", row)

conn.close()
sys.exit(0)
