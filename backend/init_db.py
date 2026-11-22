"""One-command MySQL setup for ConnectMeet (Windows friendly).

What it does:
  1. Connects to the local MySQL server as root.
  2. Creates the `connectmeet_db` database (utf8mb4).
  3. Creates a least-privilege `connectmeet` user.
  4. Applies `database/schema.sql` (all tables, keys and foreign keys).

Usage (from the `backend` folder):

    .venv\\Scripts\\python.exe init_db.py --root-password YOUR_ROOT_PASSWORD

or set the password in an environment variable first:

    $env:MYSQL_ROOT_PASSWORD="YOUR_ROOT_PASSWORD"
    .venv\\Scripts\\python.exe init_db.py

Nothing is printed except status messages — the password is never echoed.
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from pathlib import Path

import pymysql

DEFAULT_HOST = os.getenv("MYSQL_HOST", "localhost")
DEFAULT_PORT = int(os.getenv("MYSQL_PORT", "3306"))
DB_NAME = "connectmeet_db"
DB_USER = os.getenv("CONNECTMEET_DB_USER", "connectmeet")
DB_PASSWORD = os.getenv("CONNECTMEET_DB_PASSWORD", "connectmeet_pass")

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "database" / "schema.sql"


def connect(password: str, database: str | None = None):
    return pymysql.connect(
        host=DEFAULT_HOST,
        port=DEFAULT_PORT,
        user="root",
        password=password,
        database=database,
        charset="utf8mb4",
        autocommit=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Create connectmeet_db and load schema.sql")
    parser.add_argument("--root-password", help="MySQL root password")
    parser.add_argument("--db-user", default=DB_USER, help="Application DB user (default: connectmeet)")
    parser.add_argument("--db-password", default=DB_PASSWORD, help="Application DB password")
    args = parser.parse_args()

    root_password = (
        args.root_password
        or os.getenv("MYSQL_ROOT_PASSWORD")
        or getpass.getpass("MySQL root password: ")
    )

    if not SCHEMA_PATH.exists():
        print(f"ERROR: schema file not found at {SCHEMA_PATH}")
        return 1

    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")

    try:
        conn = connect(root_password)
    except pymysql.err.OperationalError as exc:
        print(f"ERROR: could not connect to MySQL on {DEFAULT_HOST}:{DEFAULT_PORT} -> {exc}")
        return 1

    try:
        with conn.cursor() as cur:
            print(f"1/4 Creating database `{DB_NAME}` (utf8mb4)...")
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
            cur.execute(f"USE `{DB_NAME}`")

            print(f"2/4 Creating application user `{args.db_user}`...")
            # CREATE USER IF NOT EXISTS is available in MySQL 5.7+ / 8.x
            cur.execute(
                f"CREATE USER IF NOT EXISTS '{args.db_user}'@'localhost' IDENTIFIED BY %s",
                (args.db_password,),
            )
            cur.execute(
                f"SET PASSWORD FOR '{args.db_user}'@'localhost' = %s", (args.db_password,)
            )
            cur.execute(f"GRANT ALL PRIVILEGES ON `{DB_NAME}`.* TO '{args.db_user}'@'localhost'")
            cur.execute("FLUSH PRIVILEGES")

            print("3/4 Applying database/schema.sql ...")
            for statement in _split_statements(schema_sql):
                cur.execute(statement)

            print("4/4 Verifying tables...")
            cur.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = %s ORDER BY table_name",
                (DB_NAME,),
            )
            tables = [row[0] for row in cur.fetchall()]
            print(f"      Tables: {', '.join(tables) if tables else 'NONE'}")

        print(
            f"\nDONE. Database `{DB_NAME}` is ready.\n"
            f"   App user : {args.db_user}\n"
            "   Password : (the one you provided)\n"
            "   Next     : copy backend\\.env.example to backend\\.env and set DATABASE_URL"
        )
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR while setting up the database: {exc}")
        return 1
    finally:
        conn.close()


def _split_statements(sql: str) -> list[str]:
    """Naive statement splitter that understands simple SQL comments/semicolons."""
    statements: list[str] = []
    buffer: list[str] = []
    for line in sql.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        buffer.append(line)
        if stripped.endswith(";"):
            statements.append("\n".join(buffer))
            buffer = []
    if buffer and "".join(buffer).strip():
        statements.append("\n".join(buffer))
    return [s for s in statements if s.strip().strip(";").strip()]


if __name__ == "__main__":
    sys.exit(main())
