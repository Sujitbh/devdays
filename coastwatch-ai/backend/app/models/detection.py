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
    area_px: float = 0.0          # pixel area of the box
    area_pct: float = 0.0         # % of total image area


class SpatialCluster(BaseModel):
    """A spatial cluster of detections (e.g. a colony or herd)."""
    cluster_id: int
    centroid_x: float
    centroid_y: float
    member_count: int
    dominant_class: str
    avg_confidence: float
    spread_px: float              # bounding radius of the cluster
    density: float                # members per 1000px²


class WildlifeSummary(BaseModel):
    """High-level ecological summary derived from YOLO detections."""
    species: str
    count: int
    confidence: float
    habitatType: str = "Marsh"
    nestingDetected: bool = False
    notes: str = ""
    threats: list[str] = []
    conservation_priority: str = "Standard"     # Standard / Elevated / Critical
    recommended_actions: list[str] = []


class DebugInfo(BaseModel):
    """Diagnostic metadata returned alongside every detection response."""
    raw_box_count: int = 0
    final_box_count: int = 0
    imgsz_used: int = 0
    conf_used: float = 0.0
    iou_used: float = 0.0
    model_name: str = ""
    image_width: int = 0
    image_height: int = 0
    image_mode: str = ""
    class_names: list[str] = []
    # Advanced pipeline info
    inference_ms: float = 0.0
    sliced_inference: bool = False
    slice_grid: str = ""          # e.g. "3x3"
    total_slices: int = 0
    merge_strategy: str = ""      # NMS / NMM
    pre_nms_count: int = 0
    post_nms_count: int = 0
    tiny_object_count: int = 0    # boxes < 32×32px
    spatial_clusters: int = 0


class DetectionResponse(BaseModel):
    """Response returned after running detection on an uploaded image."""
    success: bool
    message: str
    original_image: str
    annotated_image: str
    detections: list[BoundingBox]
    total_detections: int
    summary: Optional[WildlifeSummary] = None
    debug_info: Optional[DebugInfo] = None
    spatial_clusters: list[SpatialCluster] = []
    heatmap_image: Optional[str] = None


class DetectionRecord(BaseModel):
    """A persisted detection result with metadata."""
    id: str
    user_id: str = ""
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
    conservation_priority: str = "Standard"
    recommended_actions: list[str] = []
    spatial_clusters: list[SpatialCluster] = []


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
