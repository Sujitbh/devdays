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
USE_SUPABASE: bool = os.getenv("USE_SUPABASE", "").lower() in ("1", "true", "yes", "on")

# ---- YOLO Model ----
YOLO_MODEL: str = os.getenv("YOLO_MODEL", "yolov8n.pt")
CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.15"))

# ---- Security ----
ENV: str = os.getenv("ENV", "development")
_raw_jwt_secret: str = os.getenv("JWT_SECRET", "")
# In production, JWT_SECRET must be set (validated at startup in main.py)
JWT_SECRET: str = _raw_jwt_secret if _raw_jwt_secret else (
    "pelicaneye-dev-only-change-in-production" if ENV == "development" else ""
)
MAX_UPLOAD_BYTES: int = int(os.getenv("MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))  # 20 MB default

# Ensure directories exist at startup (may be read-only on some hosts)
try:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
except Exception as exc:
    print(f"[PelicanEye] Warning: could not create UPLOAD_DIR={UPLOAD_DIR}: {exc}")

try:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
except Exception as exc:
    print(f"[PelicanEye] Warning: could not create RESULTS_DIR={RESULTS_DIR}: {exc}")
