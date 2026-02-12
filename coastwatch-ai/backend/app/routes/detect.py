"""
PelicanEye - Detection Routes

API endpoints for uploading images and running YOLOv8 detection.
"""

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models.detection import DetectionResponse
from app.services.detector import detector_service
from app.services.detection_store import detection_store
from app.utils.image import save_upload, validate_image

router = APIRouter(prefix="/api", tags=["Detection"])

# Allowed image MIME types
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"}


@router.post("/detect", response_model=DetectionResponse)
async def detect_wildlife(file: UploadFile = File(...)):
    """
    Upload an aerial image and run YOLOv8 wildlife detection.

    Returns annotated image URL, bounding boxes, and a wildlife summary.
    Also persists the result to the detection store.
    """
    # ---- Validate file type -------------------------------------------------
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. "
                   f"Accepted: {', '.join(ALLOWED_TYPES)}",
        )

    # ---- Save uploaded file --------------------------------------------------
    saved_path = await save_upload(file)

    if not validate_image(saved_path):
        saved_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.")

    # ---- Run YOLO detection --------------------------------------------------
    try:
        detections, annotated_path = detector_service.detect(saved_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Detection failed: {exc}") from exc

    # ---- Generate wildlife summary from YOLO results -------------------------
    summary = detection_store.summarize_detections(detections)

    # ---- Persist to store ----------------------------------------------------
    original_url = f"/static/uploads/{saved_path.name}"
    annotated_url = f"/static/results/{annotated_path.name}"
    detection_store.add_record(detections, original_url, annotated_url, summary)

    # ---- Build response ------------------------------------------------------
    return DetectionResponse(
        success=True,
        message=f"Detected {len(detections)} object(s).",
        original_image=original_url,
        annotated_image=annotated_url,
        detections=detections,
        total_detections=len(detections),
        summary=summary,
    )
