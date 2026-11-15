# Deployment Guide — PHA INDIA MES Web Application

This directory (`web_app`) is a fully self-contained, deployment-ready full-stack application containing both the React 19 Frontend and Python Flask REST API server with SQLite database persistence.

---

## Architecture Summary

- **Frontend**: React 19, Vite, Lucide Icons (compiled to `web_app/dist/`).
- **Backend API**: Python 3.12 Flask REST server with normalized SQLite database (`backend/pha_india.db`).
- **Static File Serving**: In production, Flask/Gunicorn directly serves the frontend bundle (`dist/`) and the Android APK (`apk/PRESS_SHOP_MFG-2.apk`).
- **Zero External Database Setup**: Works out of the box with embedded SQLite and WAL mode.

---

## Deployment Option 1: Render / Railway / Heroku (Cloud PaaS)

1. Push the contents of the `web_app` folder to a GitHub repository (or configure `Root Directory: web_app` on Render).
2. Create a new **Web Service**:
   - **Environment**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn --chdir backend app:app --bind 0.0.0.0:$PORT`
   - **Auto-Deploy**: Enabled on Git push.
3. *Alternatively*, use the bundled `render.yaml` with Render Blueprints for one-click setup.

---

## Deployment Option 2: Docker Container

Deploy anywhere that supports Docker (AWS ECS, GCP Cloud Run, Railway, DigitalOcean App Platform, or any VPS):

```bash
# 1. Build the Docker image
docker build -t pha-india-mes .

# 2. Run container (mapped to host port 5000)
docker run -d -p 5000:5000 --name pha-mes pha-india-mes
```

The web application and API are now accessible at `http://<server-ip>:5000`.

---

## Deployment Option 3: Linux VPS (Ubuntu / Debian) with Systemd & Nginx

1. **Install Prerequisites**:
   ```bash
   sudo apt update && sudo apt install -y python3 python3-venv python3-pip nginx
   ```

2. **Setup Virtual Environment**:
   ```bash
   cd /var/www/web_app
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Create Systemd Service** (`/etc/systemd/system/pha-mes.service`):
   ```ini
   [Unit]
   Description=PHA INDIA MES Web Application
   After=network.target

   [Service]
   User=www-data
   WorkingDirectory=/var/www/web_app
   ExecStart=/var/www/web_app/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:5000 --chdir backend app:app
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```
   Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now pha-mes
   ```

4. **Nginx Reverse Proxy** (`/etc/nginx/sites-available/pha-mes`):
   ```nginx
   server {
       listen 80;
       server_name your-domain-or-ip.com;

       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```
   ```bash
   sudo ln -s /etc/nginx/sites-available/pha-mes /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl restart nginx
   ```

---

## Deployment Option 4: On-Premise Windows Machine / Factory PC

Double-click `run.bat` in the `web_app` folder:
- Automatically detects or initializes the Python environment.
- Launches the production server on `http://127.0.0.1:5000`.
- Automatically opens your default web browser to the system dashboard.
