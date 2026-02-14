"""
PelicanEye - YOLO Detection Service

Manages loading the YOLOv8 model and running inference on images.
Draws annotated bounding boxes on a copy of the original image.
"""

import logging
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from ultralytics import YOLO

from app.config import CONFIDENCE_THRESHOLD, RESULTS_DIR, YOLO_MODEL
from app.models.detection import BoundingBox

logger = logging.getLogger("pelicaneye.detector")

# ---- Aerial-optimised inference defaults ------------------------------------
DEFAULT_IMGSZ = 1280   # Larger input → small-object recall
DEFAULT_IOU   = 0.45   # NMS IoU for clustered colonies

# ---- Wildlife class filter ---------------------------------------------------
# Only these COCO class names (lowercased) are considered relevant wildlife.
# Everything else is excluded from results.
ALLOWED_CLASSES = {"bird"}
# Keywords that also pass the filter (for custom models with nest classes, etc.)
ALLOWED_KEYWORDS = {"bird", "nest", "pelican", "heron", "egret", "ibis", "tern"}


class DetectorService:
    """Singleton-style service that wraps YOLOv8 inference."""

    def __init__(self) -> None:
        self.model: YOLO | None = None
        self._model_path: str = YOLO_MODEL

    def load_model(self) -> None:
        """Load (or download) the YOLO model. Called once at startup."""
        print(f"[PelicanEye] Loading YOLO model: {self._model_path}")
        self.model = YOLO(self._model_path)
        # Log all class names so we can verify 'bird' is present
        print(f"[PelicanEye] Model loaded — {len(self.model.names)} classes")
        print(f"[PelicanEye] Class map: {self.model.names}")

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    # ---- Core Detection --------------------------------------------------------

    def detect(
        self,
        image_path: Path,
        conf_threshold: float | None = None,
    ) -> tuple[list[BoundingBox], Path, dict]:
        """
        Run YOLOv8 detection on the given image.

        Args:
            image_path     – path to the input image
            conf_threshold – confidence threshold (0.01-0.95); falls back to config

        Returns:
            detections  – list of BoundingBox objects
            result_path – path to the annotated output image
            debug_info  – dict with diagnostic metadata for the response
        """
        if not self.is_loaded:
            raise RuntimeError("YOLO model is not loaded. Call load_model() first.")

        threshold = conf_threshold if conf_threshold is not None else CONFIDENCE_THRESHOLD

        # ---- Pre-inference diagnostics ----------------------------------------
        pil_img = Image.open(image_path)
        orig_w, orig_h = pil_img.size
        img_mode = pil_img.mode
        pil_img.close()

        logger.info("="*60)
        logger.info("🔍 YOLO INFERENCE START")
        logger.info("  Image     : %s", image_path.name)
        logger.info("  Size      : %d x %d  mode=%s", orig_w, orig_h, img_mode)
        logger.info("  Model     : %s", self._model_path)
        logger.info("  imgsz     : %d", DEFAULT_IMGSZ)
        logger.info("  conf      : %.3f", threshold)
        logger.info("  iou       : %.2f", DEFAULT_IOU)
        logger.info("  classes   : (all — no filter)")

        # ---- Run inference ----------------------------------------------------
        results = self.model.predict(
            source=str(image_path),
            conf=threshold,
            iou=DEFAULT_IOU,
            imgsz=DEFAULT_IMGSZ,
            verbose=True,
        )

        result = results[0]
        boxes = result.boxes
        raw_count = len(boxes)

        logger.info("📊 YOLO raw output: %d box(es)  (conf ≥ %.3f, iou=%.2f, imgsz=%d)",
                     raw_count, threshold, DEFAULT_IOU, DEFAULT_IMGSZ)

        # ---- Parse & filter detections ----------------------------------------
        detections: list[BoundingBox] = []
        skipped = 0
        for box in boxes:
            coords = box.xyxy[0].tolist()
            cls_id = int(box.cls[0])
            cls_name = self.model.names[cls_id]
            conf = float(box.conf[0])

            # Wildlife filter: keep only birds / nests / relevant species
            name_lower = cls_name.lower()
            is_relevant = (
                name_lower in ALLOWED_CLASSES
                or any(kw in name_lower for kw in ALLOWED_KEYWORDS)
            )

            if not is_relevant:
                logger.info("  ✗ SKIP cls=%d (%s)  conf=%.4f  — not wildlife",
                             cls_id, cls_name, conf)
                skipped += 1
                continue

            logger.info("  ✓ KEEP cls=%d (%s)  conf=%.4f  box=[%.0f,%.0f,%.0f,%.0f]",
                         cls_id, cls_name, conf, *coords)
            detections.append(
                BoundingBox(
                    x1=coords[0],
                    y1=coords[1],
                    x2=coords[2],
                    y2=coords[3],
                    confidence=conf,
                    class_id=cls_id,
                    class_name=cls_name,
                )
            )

        logger.info("✅ Final detections: %d  (skipped %d non-wildlife)", len(detections), skipped)
        logger.info("="*60)

        # ---- Build debug info -------------------------------------------------
        debug_info = {
            "raw_box_count": raw_count,
            "final_box_count": len(detections),
            "imgsz_used": DEFAULT_IMGSZ,
            "conf_used": round(threshold, 4),
            "iou_used": DEFAULT_IOU,
            "model_name": self._model_path,
            "image_width": orig_w,
            "image_height": orig_h,
            "image_mode": img_mode,
            "class_names": list(self.model.names.values()),
        }

        # Draw annotated image
        annotated_path = self._draw_annotations(image_path, detections)

        return detections, annotated_path, debug_info

    # ---- Annotation Drawing ----------------------------------------------------

    @staticmethod
    def _draw_annotations(image_path: Path, detections: list[BoundingBox]) -> Path:
        """
        Draw bounding boxes and labels on a copy of the image.
        Saves the result to the results/ directory.
        """
        img = Image.open(image_path).convert("RGB")
        draw = ImageDraw.Draw(img)

        # Attempt to use a nicer font; fall back to default
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size=16)
        except OSError:
            font = ImageFont.load_default()

        # Color palette for up to 10 classes
        colors = [
            "#FF3838", "#FF9D97", "#FF701F", "#FFB21D", "#CFD231",
            "#48F90A", "#92CC17", "#3DDB86", "#1A9334", "#00D4BB",
        ]

        for det in detections:
            color = colors[det.class_id % len(colors)]
            # Bounding box
            draw.rectangle([det.x1, det.y1, det.x2, det.y2], outline=color, width=3)
            # Label background
            label = f"{det.class_name} {det.confidence:.0%}"
            text_bbox = draw.textbbox((det.x1, det.y1), label, font=font)
            draw.rectangle(
                [text_bbox[0] - 2, text_bbox[1] - 2, text_bbox[2] + 2, text_bbox[3] + 2],
                fill=color,
            )
            draw.text((det.x1, det.y1), label, fill="white", font=font)

        # Save annotated image
        out_name = f"annotated_{image_path.name}"
        out_path = RESULTS_DIR / out_name
        img.save(out_path)

        return out_path


# Global service instance (imported by routes)
detector_service = DetectorService()
