"""
PelicanEye - FastAPI Application Entry Point

Configures the app, registers middleware, mounts static files,
and includes API routers.
"""

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.config import ENV, FRONTEND_URL, HOST, JWT_SECRET, PORT, UPLOAD_DIR, RESULTS_DIR
from app.limiter import limiter
from app.models.detection import HealthResponse
from app.routes.detect import router as detect_router
from app.routes.auth import router as auth_router
from app.routes.data import router as data_router
from app.routes.alerts import router as alerts_router
from app.routes.colony import router as colony_router
from app.services.detector import detector_service
from app.services.local_auth import init_db

# ---- Logging Setup -----------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)-28s  %(levelname)-5s  %(message)s",
    datefmt="%H:%M:%S",
)


# ---- Lifespan: init DB + load model in background ---------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize auth DB and start YOLO model load in background so the server can accept connections immediately (fixes Railway healthcheck)."""
    if ENV == "production" and not JWT_SECRET:
        raise RuntimeError(
            "JWT_SECRET must be set in production. Set the JWT_SECRET environment variable."
        )
    init_db()
    # Load model in a background thread so the server starts listening right away.
    # Otherwise lifespan blocks for 2–5+ minutes (model download) and healthcheck fails.
    threading.Thread(target=detector_service.load_model, daemon=True).start()
    yield


# ---- Create FastAPI App ------------------------------------------------------

app = FastAPI(
    title="PelicanEye",
    description="AI-powered wildlife detection from aerial imagery.",
    version="0.1.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---- CORS Middleware ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
    ],
    # Allow Vercel preview URLs for this project (prevents CORS failures when the user lands on a preview domain).
    # Example preview origin: https://devdays-8by4-<hash>-bhattaraisu-ulmedus-projects.vercel.app
    allow_origin_regex=r"^https://devdays-8by4-.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Static File Mounts (serve uploaded & result images) ---------------------

app.mount("/static/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/static/results", StaticFiles(directory=str(RESULTS_DIR)), name="results")

# ---- Register Routers -------------------------------------------------------

app.include_router(detect_router)
app.include_router(auth_router)
app.include_router(data_router)
app.include_router(alerts_router)
app.include_router(colony_router)


# ---- Health Check Endpoint ---------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Returns server health and model status."""
    return HealthResponse(
        status="healthy",
        model_loaded=detector_service.is_loaded,
        version="0.1.0",
    )


# ---- Run directly with `python -m app.main` ---------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=HOST, port=int(PORT), reload=True)
