"""
PelicanEye - Pydantic Models for Detection API

Defines request/response schemas for the detection endpoint,
including Louisiana-specific fields: colony health score, life stages,
colony site, and dataset transparency.
"""

from pydantic import BaseModel
from typing import Optional, Any


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


class ColonyHealthScore(BaseModel):
    """Composite 0–100 Colony Health Score."""
    score: int                    # 0–100
    grade: str                    # Healthy / Stressed / Critical / Collapse Risk
    color: str                    # green / yellow / red
    emoji: str                    # 🟢 🟡 🔴 🚨
    components: dict[str, int]    # penalty/bonus breakdown


class WildlifeSummary(BaseModel):
    """High-level ecological summary derived from YOLO detections."""
    species: str
    count: int
    confidence: float
    habitatType: str = "Salt Marsh"
    nestingDetected: bool = False
    notes: str = ""
    threats: list[str] = []
    conservation_priority: str = "Standard"     # Standard / Elevated / Critical
    recommended_actions: list[str] = []
    # New Louisiana-specific fields
    colony_health_score: Optional[dict[str, Any]] = None   # ColonyHealthScore dict
    life_stages: Optional[dict[str, int]] = None           # e.g. {"chick": 3, "nest_active": 2}
    colony_site: Optional[str] = None                      # "Raccoon Island", "Grand Isle", etc.


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
    # Model transparency
    model_type: str = "YOLOv8n (COCO)"
    louisiana_mode: bool = False


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
    colony_health_score: Optional[dict[str, Any]] = None


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
    # New Louisiana-specific fields
    colony_health_score: Optional[dict[str, Any]] = None
    life_stages: Optional[dict[str, int]] = None
    colony_site: Optional[str] = None


class DashboardStats(BaseModel):
    """Aggregated stats for the dashboard."""
    totalImages: int
    totalDetections: int
    nestsDetected: int
    speciesCount: int
    speciesList: list[str]
    landLossAlerts: int
    # New fields
    avgColonyHealth: Optional[int] = None
    criticalSites: Optional[int] = None


class HealthResponse(BaseModel):
    """Response for the health-check endpoint."""
    status: str
    model_loaded: bool
    version: str


# ── Dataset Transparency Models ─────────────────────────────────────────────

class DatasetSource(BaseModel):
    """A single training data source entry."""
    name: str
    type: str          # "drone_imagery", "camera_trap", "satellite", "public_dataset"
    source_url: str
    license: str
    image_count: int
    classes_covered: list[str]
    geographic_region: str
    date_range: str
    annotation_method: str


class ModelCard(BaseModel):
    """Model transparency card for judges and conservation partners."""
    model_name: str
    model_architecture: str
    training_framework: str
    version: str
    last_updated: str
    classes: list[dict]           # {"name": str, "precision": float, "recall": float, "f1": float}
    dataset_sources: list[DatasetSource]
    overall_map50: float
    training_images: int
    validation_images: int
    label_strategy: str
    known_limitations: list[str]
    deployment_notes: str


class ColonySite(BaseModel):
    """A monitored Louisiana colony site."""
    name: str
    lat: float
    lng: float
    habitat: str
    species: list[str] = []
    health_score: Optional[int] = None
    last_survey: Optional[str] = None
    threat_count: int = 0
