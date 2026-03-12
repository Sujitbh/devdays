# 🦅 PelicanEye

**AI-powered wildlife detection from aerial imagery.**

A full-stack prototype using **YOLOv8** for object detection, **FastAPI** for the backend API, and **React + TypeScript + Vite** for the dashboard frontend.

---

## 📁 Project Structure

```
pelicaneye/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Environment & settings
│   │   ├── models/
│   │   │   └── detection.py     # Pydantic schemas
│   │   ├── routes/
│   │   │   └── detect.py        # /api/detect endpoint
│   │   ├── services/
│   │   │   └── detector.py      # YOLOv8 inference service
│   │   └── utils/
│   │       └── image.py         # Image save/validate helpers
│   ├── uploads/                 # Uploaded images (gitignored)
│   ├── results/                 # Annotated output images (gitignored)
│   ├── .env                     # Environment variables
│   ├── .env.example
│   ├── requirements.txt
│   └── .gitignore
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx       # App header
│   │   │   ├── ImageUploader.tsx # Drag & drop upload
│   │   │   └── DetectionResults.tsx # Results display
│   │   ├── services/
│   │   │   └── api.ts           # Axios API client
│   │   ├── types/
│   │   │   └── detection.ts     # TypeScript interfaces
│   │   ├── App.tsx              # Main app component
│   │   ├── App.css
│   │   └── index.css
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
└── README.md                    # ← You are here
```

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+** with `pip`
- **Node.js 18+** with `npm`
- macOS (tested), Linux, or Windows

---

### 1. Backend Setup

```bash
# Navigate to the backend directory
cd pelicaneye/backend

# Create a virtual environment
python3 -m venv .venv

# Activate it
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server
python -m app.main
```

The backend will start at **http://localhost:8000**.

- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

> **Note:** The first run will automatically download the YOLOv8 nano model (~6 MB).

---

### 2. Frontend Setup

```bash
# In a new terminal, navigate to the frontend directory
cd pelicaneye/frontend

# Install dependencies (already done if you scaffolded with Vite)
npm install

# Start the dev server
npm run dev
```

The frontend will start at **http://localhost:5173**.

---

### 3. Use the App

1. Open **http://localhost:5173** in your browser
2. Drag and drop (or click to upload) an aerial image
3. YOLOv8 will run detection and return annotated results
4. View bounding boxes, class names, and confidence scores

---

## 🔌 API Endpoints

| Method | Endpoint      | Description                          |
| ------ | ------------- | ------------------------------------ |
| GET    | `/health`     | Server health & model status         |
| POST   | `/api/detect` | Upload image → run detection         |
| GET    | `/docs`       | Interactive Swagger API docs         |

### Example: cURL upload

```bash
curl -X POST http://localhost:8000/api/detect \
  -F "file=@path/to/your/image.jpg"
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable                | Default              | Description                     |
| ----------------------- | -------------------- | ------------------------------- |
| `HOST`                  | `0.0.0.0`            | Server bind address             |
| `PORT`                  | `8000`               | Server port                     |
| `FRONTEND_URL`          | `http://localhost:5173` | Allowed CORS origin          |
| `UPLOAD_DIR`            | `uploads`            | Upload storage directory        |
| `RESULTS_DIR`           | `results`            | Annotated image output dir      |
| `YOLO_MODEL`            | `yolov8n.pt`         | YOLOv8 model variant            |
| `CONFIDENCE_THRESHOLD`  | `0.35`               | Min detection confidence        |

### Frontend (`frontend/.env`)

| Variable        | Default                  | Description        |
| --------------- | ------------------------ | ------------------ |
| `VITE_API_URL`  | `http://localhost:8000`  | Backend API base   |

---

## 🧠 Tech Stack

| Layer     | Technology                         |
| --------- | ---------------------------------- |
| Detection | YOLOv8 (Ultralytics)               |
| Backend   | Python, FastAPI, Pillow, Uvicorn   |
| Frontend  | React, TypeScript, Vite, Axios     |
| Styling   | Custom CSS (dark theme)            |

---

## ☁️ Deployment (Railway + Vercel)

Recommended setup:
- Backend: Railway
- Frontend: Vercel

### 1. Deploy Backend on Railway

1. Create a new Railway project from your GitHub repo.
2. Set the service **Root Directory** to `coastwatch-ai/backend`.
3. Railway will use `backend/railway.json` and `backend/Procfile`.
4. Add environment variables:

| Variable | Example |
| --- | --- |
| `HOST` | `0.0.0.0` |
| `PORT` | Railway-provided (do not hardcode if already set) |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` |
| `UPLOAD_DIR` | `uploads` |
| `RESULTS_DIR` | `results` |
| `YOLO_MODEL` | `yolov8n.pt` |
| `CONFIDENCE_THRESHOLD` | `0.35` |
| `SUPABASE_URL` | `https://...` |
| `SUPABASE_KEY` | `...` |
| `SUPABASE_JWT_SECRET` | `...` |
| `SENDGRID_API_KEY` | `...` (optional, for real email sends) |

5. After deploy, confirm backend is up:

```bash
curl https://your-backend-url.up.railway.app/health
```

### 2. Deploy Frontend on Vercel

1. Import the same GitHub repo into Vercel.
2. Set project root to `coastwatch-ai/frontend`.
3. Framework preset: **Vite**.
4. Set environment variable:

```bash
VITE_API_URL=https://your-backend-url.up.railway.app
```

5. Deploy.

`frontend/vercel.json` already includes SPA rewrite rules so routes like `/alerts` and `/dashboard` work on refresh.

### 3. Final CORS Check

Update Railway backend env var:

```bash
FRONTEND_URL=https://your-frontend.vercel.app
```

Redeploy backend after this change.

### Notes for Demo vs Production

- The app currently stores some data/files locally (`alerts.json`, `detections.json`, `users.db`, uploads/results).
- On Railway, filesystem is ephemeral; data may reset after redeploy/restart.
- For production durability, migrate records to Supabase/Postgres and image assets to object storage.

---

## 📝 License

This project is for educational / prototype purposes.
