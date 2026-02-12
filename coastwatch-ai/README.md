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

## 📝 License

This project is for educational / prototype purposes.
