"""
PelicanEye - Configuration Module

Loads environment variables and provides app-wide settings.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# ---- Base Paths ----
BASE_DIR = Path(__file__).resolve().parent.parent

# ---- Server Settings ----
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8000"))

# ---- CORS ----
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

# ---- File Storage ----
UPLOAD_DIR: Path = BASE_DIR / os.getenv("UPLOAD_DIR", "uploads")
RESULTS_DIR: Path = BASE_DIR / os.getenv("RESULTS_DIR", "results")

# ---- Supabase ----
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")

# ---- YOLO Model ----
YOLO_MODEL: str = os.getenv("YOLO_MODEL", "yolov8n.pt")
CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.35"))

# Ensure directories exist at startup
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
