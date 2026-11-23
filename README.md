# ConnectMeet

**Connect Anywhere. Meet Everywhere.**

A full-stack video conferencing web app: real camera/mic video, screen sharing, live chat, participant management, meeting history and local recording — backed by a real MySQL database, not mock data.

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + Vite + JavaScript + Tailwind CSS + React Router + Axios + Lucide + Context API |
| Backend | Python + Flask + Flask-SQLAlchemy + Flask-JWT-Extended + Flask-CORS + Flask-Migrate + Werkzeug + python-dotenv + Gunicorn |
| Database | MySQL 8 (`connectmeet_db`) via PyMySQL |
| Video & chat | Agora Web SDK (`agora-rtc-sdk-ng`) + Agora RTM (`agora-rtm-sdk`), tokens minted by the backend |

---

## Table of contents

1. [What it does](#what-it-does)
2. [Honest limitations](#honest-limitations)
3. [Prerequisites](#prerequisites)
4. [Local setup (Windows)](#local-setup-windows)
5. [Configuring Agora](#configuring-agora)
6. [Running the tests](#running-the-tests)
7. [Project structure](#project-structure)
8. [API reference](#api-reference)
9. [Deployment](#deployment)
10. [Security notes](#security-notes)
11. [Troubleshooting](#troubleshooting)

---

## What it does

**Authentication** — register, login, logout, "who am I" session restore, profile editing, password change. Passwords are hashed with Werkzeug; sessions are JWT access tokens valid for 12 hours.

**Meetings** — create a meeting (instant or scheduled), get a human-friendly code like `EJY6X-8JN9P`, share an invite link, join/leave, and a host can end the meeting for everyone or remove a participant. Past meetings show real durations in history.

**Video room** — real peer-to-peer-quality audio/video through Agora's edge network:

- Camera on/off and microphone on/off, toggled live
- Screen sharing, which automatically reverts to camera when the browser stops the share
- Active-speaker volume levels
- Participant list with roles and join times
- Host controls: end meeting for all, remove a participant
- Connection badge that reflects real Agora connection state
- Token renewal before expiry, so long meetings don't drop
- Graceful degradation: if a device or permission is missing you get an honest message and can still watch and chat

**Chat** — persisted to MySQL and delivered in real time over Agora RTM, with an automatic polling fallback so chat never silently breaks. Messages are de-duplicated by database id.

**Recording** — *local browser recording only*, with consent, stored on the user's own machine. Nothing is uploaded. See below.

---

## Honest limitations

These are deliberate, and stated so nothing here surprises you later:

- **No cloud recording.** Agora Cloud Recording is a paid add-on, so ConnectMeet does not use it. The "Record locally" control records in your own browser and saves the file to your computer. The `recordings` table stores metadata only; `recording_url` is always `NULL`.
- **No password reset email.** There is no SMTP integration, so `/forgot-password` is an honest explainer page rather than a fake flow.
- **No paid services.** Everything in [Deployment](#deployment) uses free tiers, with their real limits documented.

---

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | 20 LTS or newer recommended (`node --version`) |
| MySQL | 8.0+ | Local server running on port 3306 |
| Browser | Chrome / Edge / Firefox | Camera and microphone permission required |
| Agora account | Free | Sign up at <https://console.agora.io> |

---

## Local setup (Windows)

Commands below are PowerShell. macOS/Linux users: use `python3` and `cp` instead of `copy`.

### 1. Get the code

```powershell
git clone https://github.com/jayy999412/ConnectMeet.git
cd ConnectMeet
```

### 2. Create the database and a dedicated MySQL user

Start MySQL, then open the MySQL client as root:

```sql
CREATE DATABASE IF NOT EXISTS connectmeet_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'connectmeet'@'localhost' IDENTIFIED BY 'connectmeet_pass';
GRANT ALL PRIVILEGES ON connectmeet_db.* TO 'connectmeet'@'localhost';
FLUSH PRIVILEGES;
```

> Use your own strong password in real deployments. This one is only for local development.

Apply the schema:

```powershell
mysql -u root -p connectmeet_db < database\schema.sql
```

### 3. Backend

```powershell
cd backend

python -m venv .venv
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt

# Create backend/.env from the template, then edit the values
copy ..\.env.example .env
```

Edit `backend/.env` and set at minimum:

```ini
SECRET_KEY=<long random string>
JWT_SECRET_KEY=<a DIFFERENT long random string>
DATABASE_URL=mysql+pymysql://connectmeet:connectmeet_pass@localhost:3306/connectmeet_db
FRONTEND_URL=http://localhost:5173
AGORA_APP_ID=<your App ID>
AGORA_APP_CERTIFICATE=<your Primary Certificate>
```

Generate the secrets:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Optionally create the tables through Flask-Migrate instead of the raw SQL file:

```powershell
flask --app wsgi.py db init
flask --app wsgi.py db migrate -m "initial schema"
flask --app wsgi.py db upgrade
```

Start the API:

```powershell
python run.py
```

The API listens on **<http://127.0.0.1:5001>**. Port 5000 is deliberately avoided because it is often occupied by other local services.

### 4. Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open **<http://localhost:5173>**.

The Vite dev server proxies `/api` to `http://127.0.0.1:5001`, so no CORS setup is needed locally.

### 5. Verify

```powershell
Invoke-RestMethod http://127.0.0.1:5001/api/health
```

Expected — note the certificate is **never** returned, only a boolean:

```json
{
  "status": "ok",
  "database": "up",
  "service": "connectmeet-api",
  "agora": { "configured": true, "certificateSet": true, "appId": "...", "error": null }
}
```

Then register an account, create a meeting, click **Start meeting now**, allow the camera prompt, and open the invite link in a second browser or an incognito window to see two-way video.

---

## Configuring Agora

The App **Certificate** must never appear in the browser — the backend uses it to mint short-lived tokens.

1. Create a free account at <https://console.agora.io>.
2. **Projects → Add New Project**. Choose *Security mode: Secured* (this enables tokens).
3. Copy the **App ID** and the **Primary Certificate**.
4. Put both in `backend/.env`. Nothing goes in the frontend.
5. Restart the backend and confirm `/api/health` reports `configured: true`.

If they are missing, the app still runs: the room shows a clear banner and disables the media controls while chat and participants keep working.

> **Rotate the certificate if it is ever committed or shared.** Regenerate it in the console and update `backend/.env`.

---

## Running the tests

Tests use Python's built-in `unittest` — **no pytest required**.

```powershell
cd backend

.\.venv\Scripts\python.exe -m tests.test_api            # API, auth, meetings, chat, profile
.\.venv\Scripts\python.exe -m tests.test_agora_token    # token generation vs. reference impl
.\.venv\Scripts\python.exe -m tests.test_access_rules   # host/guest/outsider authorisation
.\.venv\Scripts\python.exe -m tests.test_live_server    # real server end-to-end
```

Each suite ends with `RESULT: N passed, 0 failed`. Current status: **93 passing, 0 failing**.

`test_agora_token` cross-validates the vendored Agora `AccessToken` implementation byte-for-byte against the official `agora-access-token` Node package, so token correctness is proven rather than assumed.

---

## Project structure

```
ConnectMeet/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # app factory, CORS, JWT, rate limiting, blueprints
│   │   ├── config.py            # env-driven configuration per environment
│   │   ├── extensions.py        # SQLAlchemy / Migrate instances
│   │   ├── models/              # user, meeting, participant, message, recording
│   │   ├── routes/              # auth, meetings, agora, chat, profile
│   │   ├── services/            # business logic + Agora token minting
│   │   └── utils/               # response envelope, validators, decorators
│   ├── tests/                   # unittest suites (93 checks)
│   ├── wsgi.py                  # production entry point (Gunicorn)
│   ├── run.py                   # development entry point (port 5001)
│   ├── Procfile                 # Render start command
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/          # UI building blocks
│       ├── context/             # Auth, Toast providers
│       ├── hooks/               # useAgora, useMeetingChat, ...
│       ├── layouts/             # Public / Dashboard shells
│       ├── pages/               # Landing, Login, Dashboard, MeetingRoom, ...
│       ├── services/            # Axios API layer
│       └── utils/               # safe post-login redirects
├── database/schema.sql          # canonical DDL
├── .env.example                 # environment template (no secrets)
├── render.yaml                  # Render blueprint for the API
└── .gitignore
```

### Database

`connectmeet_db` contains exactly five tables, defined in `database/schema.sql`:

| Table | Purpose |
| --- | --- |
| `users` | Accounts, hashed passwords, profile |
| `meetings` | Meeting metadata, code, status, host |
| `participants` | Who joined, their role, join/leave times |
| `messages` | Persisted chat history |
| `recordings` | Local recording metadata (`recording_url` is always `NULL`) |

Foreign keys, indexes and unique constraints are declared in the schema file.

---

## API reference

All responses use a flat JSON payload with a reserved `message` key.

### Auth — `/api/auth`

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register` | Returns the JWT immediately |
| POST | `/api/auth/login` | |
| GET | `/api/auth/me` | Requires `Authorization: Bearer <token>` |
| POST | `/api/auth/logout` | |

### Meetings — `/api/meetings`

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/meetings` | Create |
| GET | `/api/meetings` | List upcoming/active |
| GET | `/api/meetings/history` | Past meetings with real durations |
| GET | `/api/meetings/code/:code` | Resolve an invite code to a numeric id |
| GET | `/api/meetings/:id` | Details |
| POST | `/api/meetings/:id/join` | Records the participant; 403 removed, 410 ended |
| POST | `/api/meetings/:id/leave` | |
| POST | `/api/meetings/:id/end` | Host only — 403 otherwise |
| GET/DELETE | `/api/meetings/:id/participants[/:userId]` | Remove is host only |
| GET/POST | `/api/meetings/:id/messages` | Chat history / send |
| GET/POST | `/api/meetings/:id/recordings` | Local recording metadata only |

### Agora — `/api/agora`

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/agora/token` | Returns `rtmToken`, `rtcToken`, `appId`, `uid`, `channel`. **Never** returns the certificate. 503 if unconfigured. |
| GET | `/api/agora/health` | Agora configuration status |

### Profile — `/api/profile`

| Method | Path |
| --- | --- |
| GET/PUT | `/api/profile` |
| POST | `/api/profile/change-password` |

### Health

| Method | Path |
| --- | --- |
| GET | `/api/health` |

---

## Deployment

Three free services:

| Piece | Service | Free tier status |
| --- | --- | --- |
| Code | **GitHub** | Free plan, public or private repos |
| Frontend | **Vercel Hobby** | Free for personal/non-commercial use |
| API | **Render Free** | Free web service; sleeps after inactivity |
| Database | **Oracle Cloud Always Free MySQL** | Free for an unlimited time |

> **Why Oracle?** Render, Neon, Supabase and Aiven all offer only free *PostgreSQL*; Aiven retired its free MySQL tier, and PlanetScale removed its free plan. Oracle Cloud is the only provider I verified that lists a **MySQL** instance under *Always Free* with no end date.

**Nothing is deployed until you complete the steps below.** This repository contains configuration only.

### Step 1 — GitHub

```powershell
git add -A
git commit -m "Deploy"
git push origin main
```

`.gitignore` excludes `backend/.env`, `node_modules`, `__pycache__` and logs. Before every push, confirm no secrets slipped in:

```powershell
git status
git diff --cached --name-only | Select-String -Pattern '\.env$'
```

That must return nothing but `.env.example` files.

### Step 2 — Oracle Cloud Always Free MySQL (~15 min)

1. Sign up at <https://www.oracle.com/cloud/free/>. Always Free services need **no payment method charges**; a card may be requested for identity verification only.
2. In the Oracle Cloud console open **Navigation → Databases → MySQL**, then **Create MySQL DB System**.
3. Choose:
   - **Deployment type:** *Standalone MySQL*
   - **Shape:** the Always Free-eligible shape
   - **Storage:** up to **50 GB** (Always Free allowance)
   - **Version:** MySQL 8.0.x
   - **Access:** enable **public IP** so Render can connect
4. Create a database admin user and note the password.
5. In the DB system's **Connections / IP allow lists**, add `0.0.0.0/0` (or Render's egress range) — otherwise your API cannot connect.
6. Create the schema and app user. Connect with any MySQL client using the public host, port `3306`, then run:

   ```sql
   CREATE DATABASE IF NOT EXISTS connectmeet_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER IF NOT EXISTS 'connectmeet'@'%' IDENTIFIED BY '<strong password>';
   GRANT ALL PRIVILEGES ON connectmeet_db.* TO 'connectmeet'@'%';
   FLUSH PRIVILEGES;
   ```

   Then apply `database/schema.sql` to `connectmeet_db`.

7. Build the connection string:

   ```
   mysql+pymysql://connectmeet:<password>@<public-host>:3306/connectmeet_db
   ```

**Always Free limits to respect:** one standalone MySQL DB system in your home region, 50 GB storage and 50 GB backup storage. Exceeding them can cause the service to be reclaimed.

### Step 3 — Render (the API)

1. Push the repo to GitHub (Step 1).
2. Render dashboard → **New → Blueprint** → pick the repository. Render reads `render.yaml` and creates `connectmeet-api`.
3. Fill in the environment variables the blueprint marks as *secret*:
   - `SECRET_KEY`, `JWT_SECRET_KEY` — generate each with `python -c "import secrets; print(secrets.token_urlsafe(48))"`
   - `DATABASE_URL` — the Oracle MySQL connection string from Step 2
   - `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` — from your Agora project
   - `FRONTEND_URL` — your Vercel URL from Step 4, e.g. `https://connectmeet.vercel.app`
4. Deploy and wait for the health check at `/api/health` to go green.

Render's free plan **sleeps after ~15 minutes of inactivity**, so the first request after idle can take 30–60 seconds.

### Step 4 — Vercel (the frontend)

1. Vercel dashboard → **Add New → Project** → import the repository.
2. Settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
3. Add the environment variable:

   ```
   VITE_API_BASE_URL = https://connectmeet-api.onrender.com
   ```

   Without it the frontend calls its own origin and every API request 404s.
4. Deploy, then copy the production URL back into `FRONTEND_URL` on Render and redeploy so CORS allows it.

`frontend/vercel.json` already rewrites all routes to `index.html`, so refreshing `/room/12` on the live site works.

### Step 5 — Verify the live deployment

```powershell
Invoke-RestMethod https://connectmeet-api.onrender.com/api/health
```

Then, in a real browser:

1. Register and create a meeting on the live URL.
2. Click **Start meeting now** and allow camera/microphone.
3. Copy the invite link and open it in a second browser profile or incognito window.
4. Log in as a second account and confirm two-way video, audio, chat and participant counts.

---

## Security notes

- **Passwords** hashed with Werkzeug's adaptive KDF.
- **JWT** access tokens, 12-hour expiry, `Authorization: Bearer` header.
- **Agora App Certificate** lives only in `backend/.env`; the browser receives short-lived tokens from `/api/agora/token`. The certificate is never returned by any endpoint.
- **Rate limiting** on auth and join endpoints, in-memory per process.
- **CORS** restricted to `FRONTEND_URL` plus any `EXTRA_CORS_ORIGINS`.
- **No secrets in the repository.** `.env` files are ignored; only `.env.example` templates are committed.

### Secrets handling checklist

- [ ] `backend/.env` exists only on your machine
- [ ] `git status` shows no `.env` (other than `.env.example`)
- [ ] Agora certificate regenerated if it was ever committed or shared
- [ ] `SECRET_KEY` and `JWT_SECRET_KEY` are long and unique per environment
- [ ] Production MySQL user is not the root account

---

## Troubleshooting

**"Video calling is not configured" / media controls disabled**
`AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` are missing or the backend was not restarted. Check `/api/health`.

**"Camera access denied by the browser"**
The browser blocked `getUserMedia`. Click the camera icon in the address bar and allow camera and microphone, then rejoin. The message is accurate — it is a browser permission decision, not a hardware fault.

**"No camera found on this device"**
No capture device is present or it is claimed by another app.

**Chat feels slow / "polling fallback" in the console**
Agora RTM could not connect. Chat still works over the REST polling fallback, but check that the RTM token is issued and no ad-blocker is interfering.

**Invite link lands on the dashboard instead of the join page**
Ensure the frontend build includes `frontend/src/utils/navigation.js` and that `ProtectedRoute` forwards `location.pathname + location.search`.

**CORS errors on the live site**
`FRONTEND_URL` on Render must exactly match your Vercel origin, including `https://`.

**`410 Gone` when joining**
The meeting was ended by the host.

**Port 5000 already in use**
Expected — the dev server runs on 5001. Override with the `PORT` environment variable if needed.

---

## License

For personal and educational use.
