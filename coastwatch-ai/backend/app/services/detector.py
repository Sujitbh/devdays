"""
PelicanEye - YOLO Detection Service

Manages loading the YOLOv8 model and running inference on images.
Draws annotated bounding boxes on a copy of the original image.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from ultralytics import YOLO

from app.config import CONFIDENCE_THRESHOLD, RESULTS_DIR, YOLO_MODEL
from app.models.detection import BoundingBox


class DetectorService:
    """Singleton-style service that wraps YOLOv8 inference."""

    def __init__(self) -> None:
        self.model: YOLO | None = None

    def load_model(self) -> None:
        """Load (or download) the YOLO model. Called once at startup."""
        print(f"[PelicanEye] Loading YOLO model: {YOLO_MODEL}")
        self.model = YOLO(YOLO_MODEL)
        print("[PelicanEye] Model loaded successfully.")

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    # ---- Core Detection --------------------------------------------------------

    def detect(self, image_path: Path) -> tuple[list[BoundingBox], Path]:
        """
        Run YOLOv8 detection on the given image.

        Returns:
            detections  – list of BoundingBox objects
            result_path – path to the annotated output image
        """
        if not self.is_loaded:
            raise RuntimeError("YOLO model is not loaded. Call load_model() first.")

        # Run inference
        results = self.model.predict(
            source=str(image_path),
            conf=CONFIDENCE_THRESHOLD,
            verbose=False,
        )

        result = results[0]
        boxes = result.boxes

        # Parse detections
        detections: list[BoundingBox] = []
        for box in boxes:
            coords = box.xyxy[0].tolist()
            detections.append(
                BoundingBox(
                    x1=coords[0],
                    y1=coords[1],
                    x2=coords[2],
                    y2=coords[3],
                    confidence=float(box.conf[0]),
                    class_id=int(box.cls[0]),
                    class_name=self.model.names[int(box.cls[0])],
                )
            )

        # Draw annotated image
        annotated_path = self._draw_annotations(image_path, detections)

        return detections, annotated_path

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
