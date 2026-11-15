# PHA INDIA MES — Web Application (Standalone & Deployable)

This folder contains the complete, self-contained **PHA INDIA PRIVATE LIMITED** Web Application. It can be built, executed, containerized, and deployed independently to any cloud host, VPS, or on-premise server.

---

## Folder Organization

```text
web_app/
├── src/                  # React 19 frontend source code (pages, components, styles)
├── public/               # Static assets (favicons, manifest.json)
├── dist/                 # Production compiled frontend bundle (HTML/CSS/JS)
├── backend/              # Flask REST API server and SQLite database
│   ├── app.py            # API routes and static asset serving
│   ├── database.py       # SQLite connection and database schema
│   ├── pha_india.db      # Persistent SQLite production database
│   ├── requirements.txt  # Python requirements
│   └── test_backend.py   # Automated backend test suite
├── apk/                  # Android APK installer copy for web download
│   └── PRESS_SHOP_MFG-2.apk
├── package.json          # Node dependencies and build scripts
├── vite.config.js        # Vite bundler configuration
├── index.html            # Frontend HTML entry point
├── requirements.txt      # Root Python requirements for cloud builders (Render/Railway)
├── Procfile              # Gunicorn web process definition
├── render.yaml           # Render blueprint deployment configuration
├── Dockerfile            # Production Docker container image definition
├── .dockerignore         # Docker build exclude rules
├── .gitignore            # Git ignore rules
├── run.bat               # One-click standalone production server launcher
├── run_dev.bat           # One-click live development mode launcher
├── DEPLOYMENT.md         # Step-by-step cloud & VPS deployment guide
├── check_data.py         # Database query & verification utility
├── seed_attendance.py    # Attendance roster seeding utility
└── seed_employees.py     # Employee directory seeding utility
```

---

## Quick Start (Local)

### Standalone Production Server:
Double-click `run.bat` or run:
```cmd
python -m venv venv
call venv\Scripts\activate.bat
pip install -r requirements.txt
python backend\app.py
```
Open `http://127.0.0.1:5000` in your browser.

### Full-Stack Development Mode:
Double-click `run_dev.bat` or run:
```cmd
# Terminal 1: Backend API
python backend\app.py

# Terminal 2: React Frontend
npm run dev
```

---

## Deploying to Cloud / Production

See [DEPLOYMENT.md](file:///d:/project%20web/web_app/DEPLOYMENT.md) for detailed instructions on:
1. **Render / Railway / Heroku** (using `Procfile` / `render.yaml`)
2. **Docker Container** (using `Dockerfile`)
3. **Linux VPS** (Ubuntu / Debian with Systemd & Nginx)
4. **On-Premise Windows Machine** (Single-click `run.bat`)
