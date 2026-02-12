"""
PelicanEye - Pydantic Models for Detection API

Defines request/response schemas for the detection endpoint.
"""

from pydantic import BaseModel
from typing import Optional


class BoundingBox(BaseModel):
    """A single detected object with its bounding box and metadata."""
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    class_id: int
    class_name: str


class WildlifeSummary(BaseModel):
    """High-level ecological summary derived from YOLO detections."""
    species: str
    count: int
    confidence: float
    habitatType: str = "Marsh"
    nestingDetected: bool = False
    notes: str = ""
    threats: list[str] = []


class DetectionResponse(BaseModel):
    """Response returned after running detection on an uploaded image."""
    success: bool
    message: str
    original_image: str        # URL path to the uploaded image
    annotated_image: str       # URL path to the annotated result image
    detections: list[BoundingBox]
    total_detections: int
    summary: Optional[WildlifeSummary] = None


class DetectionRecord(BaseModel):
    """A persisted detection result with metadata."""
    id: str
    species: str
    count: int
    confidence: float
    habitatType: str
    nestingDetected: bool
    notes: str
    threats: list[str] = []
    lat: float
    lng: float
    timestamp: str
    imageUrl: str
    annotatedImageUrl: str
    boundingBoxes: list[BoundingBox] = []


class DashboardStats(BaseModel):
    """Aggregated stats for the dashboard."""
    totalImages: int
    totalDetections: int
    nestsDetected: int
    speciesCount: int
    speciesList: list[str]
    landLossAlerts: int


class HealthResponse(BaseModel):
    """Response for the health-check endpoint."""
    status: str
    model_loaded: bool
    version: str
