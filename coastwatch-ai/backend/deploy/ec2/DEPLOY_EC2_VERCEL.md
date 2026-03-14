# Deploy PelicanEye with EC2 (backend) + Vercel (frontend)

## 1. EC2 instance setup

Use Ubuntu 22.04 LTS and open inbound rules:
- 22 (SSH)
- 80 (HTTP)
- 443 (HTTPS)

Connect to instance:

ssh -i /path/to/key.pem ubuntu@YOUR_EC2_PUBLIC_IP

Install system packages:

sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip nginx certbot python3-certbot-nginx git

## 2. Clone project on EC2

sudo mkdir -p /opt/pelicaneye
sudo chown -R ubuntu:ubuntu /opt/pelicaneye
cd /opt/pelicaneye
git clone YOUR_GITHUB_REPO_URL .
cd /opt/pelicaneye/coastwatch-ai/backend

## 3. Create Python environment and install deps

python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

## 4. Configure backend environment

cp .env.example .env
nano .env

Set values in .env:
- HOST=0.0.0.0
- PORT=8000
- FRONTEND_URL=https://YOUR_VERCEL_DOMAIN
- SUPABASE_URL=...
- SUPABASE_KEY=...
- SUPABASE_JWT_SECRET=...
- YOLO_MODEL=yolov8n.pt
- CONFIDENCE_THRESHOLD=0.35

Test backend directly:

.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000

In another SSH tab:

curl http://127.0.0.1:8000/health

## 5. Configure systemd service

Copy service file:

sudo cp /opt/pelicaneye/coastwatch-ai/backend/deploy/ec2/pelicaneye.service /etc/systemd/system/pelicaneye.service

Update these lines in /etc/systemd/system/pelicaneye.service if your paths differ:
- WorkingDirectory
- EnvironmentFile
- ExecStart

Then enable service:

sudo systemctl daemon-reload
sudo systemctl enable pelicaneye
sudo systemctl start pelicaneye
sudo systemctl status pelicaneye

## 6. Configure nginx reverse proxy

Copy nginx config:

sudo cp /opt/pelicaneye/coastwatch-ai/backend/deploy/ec2/nginx-pelicaneye.conf /etc/nginx/sites-available/pelicaneye

Edit server_name to your API domain (example: api.yourdomain.com):

sudo nano /etc/nginx/sites-available/pelicaneye

Enable and reload nginx:

sudo ln -s /etc/nginx/sites-available/pelicaneye /etc/nginx/sites-enabled/pelicaneye
sudo nginx -t
sudo systemctl reload nginx

## 7. Add HTTPS certificate (Certbot)

sudo certbot --nginx -d api.yourdomain.com

Verify:

curl https://api.yourdomain.com/health

## 8. Deploy frontend to Vercel

In Vercel:
- Import GitHub repo
- Root directory: coastwatch-ai/frontend
- Framework preset: Vite

Set env vars in Vercel project:
- VITE_API_URL=https://api.yourdomain.com
- VITE_SUPABASE_URL=... (if used)
- VITE_SUPABASE_ANON_KEY=... (if used)

Deploy and note your Vercel domain.

## 9. Final CORS check

Update backend .env on EC2:
- FRONTEND_URL=https://YOUR_VERCEL_DOMAIN

Then restart backend:

sudo systemctl restart pelicaneye

## 10. Ops commands

Check logs:

sudo journalctl -u pelicaneye -f

Restart app:

sudo systemctl restart pelicaneye

Restart nginx:

sudo systemctl restart nginx
