# flashback-archive-20261013 — Components

Time-capsule archive (2026-10-13) of the "Flashback"/Emulation2K retro-arcade
platform: FastAPI backend, Python gateway/static server, ngrok tunnel, plus
legacy Firebase configurations and a raw git repository.

## systemd services

Unit files live at the archive root (they reference the original production
paths under `/opt/emulation2k` and the `emulation2k` system user).

| Unit | Type | Purpose |
|---|---|---|
| `emulation2k.service` | simple | FastAPI backend via uvicorn on `127.0.0.1:8010`, with admin bootstrap env vars. Runs as user/group `emulation2k`. Logs to journal. `Restart=always`, `RestartSec=3`. |
| `emulation2k-gateway.service` | simple | Public gateway + static server (`gateway:app` via uvicorn, port 8010). Ordered after / wants `emulation2k.service`. Logs to journal. |
| `emulation2k-ngrok.service` | simple | ngrok tunnel for port 8010 using `/home/emulation2k/ngrok.yml`. Ordered after / wants `emulation2k-gateway.service`. |

## Libraries / dependencies

### Python (`emulation2k-project/requirements.txt`)
- fastapi `>=0.143.0`
- uvicorn `>=0.54.0`
- python-dotenv `>=1.0.0`
- argon2-cffi `>=25.0.0`
- python-multipart `>=0.0.9`

### Node (`emulation2k-project/functions/package.json` — Firebase Cloud Functions)
- firebase-admin, firebase-functions, nodemailer (per package.json in `functions/`)

## Other components

- `emulation2k-project/backend/main.py` — FastAPI application.
- `emulation2k-project/.venv/` — Python virtual environment.
- `emulation2k-project/functions/index.js` — Firebase Cloud Functions entry point.
- `emulation2k-project/public/` — static frontend incl. `no-firebase-shim.js` (offline Firebase shim).
- `emulation2k-project/firebase.json`, `.firebaserc`, `firestore.rules` — Firebase project config.
- `emulation2k-project/data/` — SQLite DB (`flashback.sqlite3`) + `uploads/`.
- `emulation2k-project/firestore-debug.log` — debug log.
- `firebase-legacy/` — older Firebase config set: `firebase.json`, `firestore.rules`, `storage.rules`, `functions/`, `backend/`, `public/`, `gateway.py`.
- `git-repo/` — bare-style git repository (objects/refs only).
- `ngrok.yml` — ngrok tunnel config.
