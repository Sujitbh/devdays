# Deploy PelicanEye (CoastWatch AI) for Competition / Production

This guide walks you through deploying the **backend on Railway** and the **frontend on Vercel** so your app is live and shareable (e.g. for a competition or demo).

---

## Prerequisites

- **GitHub**: Your code is in a GitHub repository.
- **Railway account**: [railway.app](https://railway.app) — sign up (free tier is fine).
- **Vercel account**: [vercel.com](https://vercel.com) — sign up (free tier is fine).

**Repo layout**: If your repo root is the folder that contains both `backend/` and `frontend/` (e.g. `coastwatch-ai` or `devdays`), you will set **Root Directory** for each service as below. If your repo root is already `backend` or `frontend`, use `./` for that service.

---

## Part 1: Deploy the backend on Railway

### 1.1 Create a new project

1. Go to [railway.app](https://railway.app) and log in.
2. Click **New Project**.
3. Choose **Deploy from GitHub repo**.
4. Select your repository and (if asked) the branch (e.g. `main`).

### 1.2 Configure the backend service

1. After the project is created, click the new service (or **Add Service** → **GitHub Repo** and select the same repo).
2. Open **Settings** for the service.
3. Under **Source**:
   - Set **Root Directory** to:
     - `coastwatch-ai/backend` if your repo root contains a `coastwatch-ai` folder, or
     - `backend` if your repo root is the app folder (contains `backend` and `frontend`).
4. Under **Deploy**:
   - **Build Command**: leave default (Nixpacks will use `requirements.txt`).
   - **Start Command**: Railway uses the `Procfile` or `railway.json`; no need to change unless you override.
   - **Watch Paths**: leave default so pushes to the repo trigger deploys.

### 1.3 Set environment variables

In the same service, go to **Variables** and add:

| Variable | Value | Required |
|----------|--------|----------|
| `ENV` | `production` | Yes |
| `JWT_SECRET` | A long random string (e.g. generate with `openssl rand -hex 32`) | Yes in production |
| `HOST` | `0.0.0.0` | Yes |
| `PORT` | Leave empty — Railway sets this automatically | — |
| `FRONTEND_URL` | `https://your-app.vercel.app` (placeholder for now; use your real Vercel URL after Part 2) | Yes |
| `UPLOAD_DIR` | `uploads` | Optional |
| `RESULTS_DIR` | `results` | Optional |
| `YOLO_MODEL` | `yolov8n.pt` | Optional |
| `CONFIDENCE_THRESHOLD` | `0.35` | Optional |
| `MAX_UPLOAD_BYTES` | `20971520` (20 MB) | Optional |

**Generate a secure JWT secret** (run in terminal):

```bash
openssl rand -hex 32
```

Paste the output as `JWT_SECRET`.

**Optional** (for Supabase / SendGrid): Add `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_JWT_SECRET`, `SENDGRID_API_KEY` if you use them.

### 1.4 Deploy and get the backend URL

1. Trigger a deploy (push to GitHub or **Deploy** in Railway).
2. In **Settings** → **Networking**, click **Generate Domain** (or use an existing domain).
3. Copy the public URL, e.g. `https://your-backend.up.railway.app`.

**Check backend health:**

```bash
curl https://your-backend.up.railway.app/health
```

You should see something like `{"status":"healthy","model_loaded":true,...}`. The first deploy may take a few minutes while the YOLO model downloads.

---

## Part 2: Deploy the frontend on Vercel

### 2.1 Import the project

1. Go to [vercel.com](https://vercel.com) and log in.
2. Click **Add New** → **Project**.
3. Import your GitHub repository.
4. Configure:
   - **Root Directory**: Click **Edit** and set to:
     - `coastwatch-ai/frontend` if your repo has a `coastwatch-ai` folder, or
     - `frontend` if your repo root contains `frontend` and `backend`.
   - **Framework Preset**: Vite (should be auto-detected).
   - **Build Command**: `npm run build` (default).
   - **Output Directory**: `dist` (default for Vite).

### 2.2 Set environment variable

Under **Environment Variables**, add:

| Name | Value |
|------|--------|
| `VITE_API_URL` | Your Railway backend URL, e.g. `https://your-backend.up.railway.app` |

Use the **exact** URL from Part 1 (no trailing slash is fine). This is baked in at build time, so redeploy the frontend if you change the backend URL.

### 2.3 Deploy

1. Click **Deploy**.
2. When the build finishes, Vercel gives you a URL like `https://your-project.vercel.app`. Copy it.

---

## Part 3: Connect frontend and backend (CORS)

1. Go back to **Railway** → your backend service → **Variables**.
2. Set **FRONTEND_URL** to your **exact** Vercel URL, e.g. `https://your-project.vercel.app`.
   - If you use a custom domain on Vercel, use that URL instead.
3. Save and **redeploy** the backend so the new CORS origin is applied.

Your app should now be live: open the Vercel URL in a browser. You can register, log in, and use the AI Analyzer.

---

## Checklist before presenting

- [ ] Backend health: `curl https://your-backend.up.railway.app/health` returns `"status":"healthy"`.
- [ ] Frontend loads at your Vercel URL.
- [ ] You can register and log in (confirms auth and CORS).
- [ ] You can upload an image in AI Analyzer and get a detection result (confirms API and YOLO).
- [ ] `ENV=production` and `JWT_SECRET` are set on Railway (no default dev secret in production).

---

## Troubleshooting

**"Invalid or expired token" / 401 after login**

- Ensure `JWT_SECRET` is set on Railway and `ENV=production`. Redeploy backend after changing variables.

**CORS errors in the browser**

- Backend `FRONTEND_URL` must match the URL in the address bar (scheme + host, no path). E.g. `https://your-project.vercel.app`. No trailing slash. Redeploy backend after changing.

**Frontend shows "Backend unreachable" or API errors**

- Confirm `VITE_API_URL` on Vercel is the same as your Railway backend URL. Rebuild and redeploy the frontend (env vars are embedded at build time).

**Railway build fails (e.g. Python / slowapi)**

- Ensure `backend/requirements.txt` includes `slowapi>=0.1.9` and that Root Directory is set to the folder that contains `requirements.txt` and `app/`.

**Upload fails with "File too large"**

- Default max is 20 MB. You can increase `MAX_UPLOAD_BYTES` on Railway (e.g. `31457280` for 30 MB).

---

## Data and persistence

- On Railway, the filesystem is **ephemeral**: uploads, results, `users.db`, and JSON stores may be lost on restart/redeploy. For a **competition or short demo** this is usually acceptable.
- For long-term production, plan to move users and data to a database (e.g. Supabase/Postgres) and uploads to object storage; the README has notes on this.

Good luck with your competition.
