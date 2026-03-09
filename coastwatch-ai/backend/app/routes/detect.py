"""
PelicanEye - Detection Routes

API endpoints for uploading images and running YOLOv8 detection.
"""

import logging
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.config import CONFIDENCE_THRESHOLD
from app.models.detection import DebugInfo, DetectionResponse, SpatialCluster
from app.services.detector import detector_service
from app.services.detection_store import detection_store
from app.utils.image import save_upload, validate_image
from app.utils.dependencies import get_current_user_id
from app.utils.gps import extract_gps_from_image

logger = logging.getLogger("pelicaneye.detect")

router = APIRouter(prefix="/api", tags=["Detection"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"}


@router.post("/detect", response_model=DetectionResponse)
async def detect_wildlife(
    file: UploadFile = File(...),
    conf_threshold: float = Form(None),
    user_id: str = Depends(get_current_user_id),
):
    """
    Upload an aerial image and run the advanced YOLOv8 wildlife pipeline.

    Features:
      • Multi-scale inference (640 + 1280)
      • SAHI-style sliced inference for large images (>2000px)
      • Cross-scale NMS deduplication
      • Spatial clustering (DBSCAN-lite)
      • Density heatmap generation
      • Conservation priority + recommended actions
    """
    threshold = conf_threshold if conf_threshold is not None else CONFIDENCE_THRESHOLD
    threshold = max(0.01, min(0.95, threshold))

    logger.info("📥 Received file: %s  size: %s  type: %s  threshold: %.2f",
                file.filename, file.size, file.content_type, threshold)

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. "
                   f"Accepted: {', '.join(ALLOWED_TYPES)}",
        )

    saved_path = await save_upload(file)
    logger.info("💾 Saved upload to: %s", saved_path)

    if not validate_image(saved_path):
        saved_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.")

    # ── Extract GPS coordinates from image EXIF ─────────────────────────
    gps_coords = extract_gps_from_image(str(saved_path))
    if gps_coords:
        logger.info("📍 GPS detected: %.6f°N, %.6f°W", gps_coords[0], abs(gps_coords[1]))
    else:
        logger.info("📍 No GPS data in image - using habitat inference")

    # ── Run advanced detection pipeline ──────────────────────────────────
    try:
        detections, annotated_path, debug_info, clusters, heatmap_path = \
            detector_service.detect(saved_path, threshold)
    except Exception as exc:
        logger.exception("Detection failed")
        raise HTTPException(status_code=500, detail=f"Detection failed: {exc}") from exc

    logger.info("✅ Detection complete: %d object(s), %d cluster(s), %.0fms",
                len(detections), len(clusters), debug_info.get("inference_ms", 0))

    # ── Generate wildlife summary ────────────────────────────────────────
    summary = detection_store.summarize_detections(
        detections, 
        clusters,
        image_width=debug_info.get("image_width", 0),
        image_height=debug_info.get("image_height", 0),
        gps_coords=gps_coords,
    )

    # ── Persist to store ─────────────────────────────────────────────────
    original_url = f"/static/uploads/{saved_path.name}"
    annotated_url = f"/static/results/{annotated_path.name}"
    heatmap_url = f"/static/results/{heatmap_path.name}" if heatmap_path else None

    detection_store.add_record(
        detections, original_url, annotated_url, summary, clusters,
        user_id=user_id,
    )

    # ── Build response ───────────────────────────────────────────────────
    health = summary.colony_health_score
    msg = (
        f"Louisiana coastal analysis: {len(detections)} detection(s) in {len(clusters)} cluster(s). "
        f"Colony Health: {health['score']}/100 ({health['grade']}) | Priority: {summary.conservation_priority}."
        if health else
        f"Detected {len(detections)} object(s). Priority: {summary.conservation_priority}."
    )
    return DetectionResponse(
        success=True,
        message=msg,
        original_image=original_url,
        annotated_image=annotated_url,
        detections=detections,
        total_detections=len(detections),
        summary=summary,
        debug_info=DebugInfo(**debug_info),
        spatial_clusters=clusters,
        heatmap_image=heatmap_url,
        colony_health_score=health,
    )
