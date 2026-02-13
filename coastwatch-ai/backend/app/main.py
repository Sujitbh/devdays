"""
PelicanEye - FastAPI Application Entry Point

Configures the app, registers middleware, mounts static files,
and includes API routers.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import FRONTEND_URL, HOST, PORT, UPLOAD_DIR, RESULTS_DIR
from app.models.detection import HealthResponse
from app.routes.detect import router as detect_router
from app.routes.auth import router as auth_router
from app.routes.data import router as data_router
from app.services.detector import detector_service

# ---- Logging Setup -----------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)-28s  %(levelname)-5s  %(message)s",
    datefmt="%H:%M:%S",
)


# ---- Lifespan: load model on startup ----------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the YOLO model when the server starts."""
    detector_service.load_model()
    yield


# ---- Create FastAPI App ------------------------------------------------------

app = FastAPI(
    title="PelicanEye",
    description="AI-powered wildlife detection from aerial imagery.",
    version="0.1.0",
    lifespan=lifespan,
)

# ---- CORS Middleware ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
    ],
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
