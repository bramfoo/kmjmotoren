# Deploy – KMJ Motoren (Hetzner / Linux + SQLite)

The site is static HTML/CSS/JS plus a small **Node + Express + better-sqlite3** API
(in `server/`). Data lives in a single SQLite file; uploaded photos/videos live on disk.

Target: a small Linux box (e.g. Hetzner CX), Ubuntu/Debian. Plan:

```
        ┌──────────────── nginx (:80/:443) ───────────────┐
visitor │  /          → static files (this repo)           │
        │  /uploads/* → server/uploads (media on disk)     │
        │  /api/*      → reverse proxy → 127.0.0.1:3000     │
        └──────────────────────┬──────────────────────────┘
                               ▼
                node API (systemd service, :3000)
                ├── server/data.db   (SQLite)
                └── server/uploads/  (media)
```

---

## 1. Install Node.js + nginx
```bash
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx
# better-sqlite3 ships a prebuilt Linux binary; if it ever needs to compile:
# sudo apt install -y build-essential python3
```

## 2. Get the code onto the server
```bash
sudo mkdir -p /var/www/kmjmotoren
sudo chown $USER:$USER /var/www/kmjmotoren
git clone <your-repo-url> /var/www/kmjmotoren
cd /var/www/kmjmotoren/server
npm install --omit=dev          # builds better-sqlite3 (allowed via package.json "allowScripts")
```

## 3. Configure secrets + admin
```bash
# A fixed session secret (so logins survive restarts):
echo "SESSION_SECRET=$(openssl rand -hex 48)" | sudo tee /etc/kmjmotoren.env
echo "NODE_ENV=production" | sudo tee -a /etc/kmjmotoren.env

# Create your admin login:
cd /var/www/kmjmotoren/server
node set-admin.js "jij@kmjmotoren.nl" "<sterk-wachtwoord>"
```
> `NODE_ENV=production` makes the session cookie **Secure** (HTTPS-only) — so finish step 6 (TLS) before logging in over the internet.

## 4. Run the API as a systemd service
Create `/etc/systemd/system/kmjmotoren.service`:
```ini
[Unit]
Description=KMJ Motoren API
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/kmjmotoren/server
EnvironmentFile=/etc/kmjmotoren.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```
Make sure the app can write its db/uploads, then start it:
```bash
sudo chown -R www-data:www-data /var/www/kmjmotoren/server
sudo systemctl daemon-reload
sudo systemctl enable --now kmjmotoren
sudo systemctl status kmjmotoren     # should be "active (running)"
```

## 5. nginx site config
Create `/etc/nginx/sites-available/kmjmotoren`:
```nginx
server {
    listen 80;
    server_name kmjmotoren.nl www.kmjmotoren.nl;   # or your domain / server IP

    root /var/www/kmjmotoren;
    index index.html;

    client_max_body_size 160M;        # allow video uploads (server cap is 150M)

    # Never expose server internals / VCS
    location ~ ^/(server|\.git|\.claude) { deny all; return 404; }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        alias /var/www/kmjmotoren/server/uploads/;
        access_log off;
        expires 30d;
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
```
Enable it:
```bash
sudo ln -s /etc/nginx/sites-available/kmjmotoren /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 6. HTTPS (Let's Encrypt)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d kmjmotoren.nl -d www.kmjmotoren.nl
```

## 7. Done
Open the site, click **Beheer** (bottom-right), log in with the admin from step 3.
The "Nieuw product toevoegen" and "Media toevoegen" forms appear; visitors only see results.

---

## Updating later
```bash
cd /var/www/kmjmotoren
git pull
cd server && npm install --omit=dev
sudo systemctl restart kmjmotoren
```

## Backups (important — your data is just files)
```bash
# Example daily backup via cron (crontab -e):
0 3 * * * sqlite3 /var/www/kmjmotoren/server/data.db ".backup '/var/backups/kmj-$(date +\%F).db'" && \
          tar czf /var/backups/kmj-uploads-$(date +\%F).tgz -C /var/www/kmjmotoren/server uploads
```
Keep copies off the box (e.g. `rsync`/`scp` to another host or object storage).

## Notes
- **Frontend → API base:** `config.js` has `API_BASE: ""` (same origin). Leave empty — nginx serves
  static + proxies `/api` on the same domain.
- **Resource use:** the Node process is small; SQLite has no separate daemon. Comfortable on a shared CX box.
- **Local development (Windows):** `cd server && npm install`, then `node server.js`, open http://localhost:3000.
