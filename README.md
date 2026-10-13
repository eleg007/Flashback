# Flashback - No Firebase

Self-contained Flash game emulator with cloud library and admin management, built with FastAPI, SQLite, and vanilla JS.

## Local development
```bash
cd /opt/emulation2k
/opt/emulation2k/.venv/bin/pip install -r requirements.txt
/opt/emulation2k/.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8010
```

## Production user service
```bash
sudo systemctl enable --now emulation2k.service
sudo systemctl is-active emulation2k.service
```

## Fresh admin
- Username: `admin@flashback.local`
- Password: `ChangeMe123!`
Change it in `FLASHBACK_ADMIN_PASSWORD`.
