"""
PelicanEye - Detection Store

Simple JSON-file-backed store for persisting detection records.
Suitable for a DevDays prototype. For production, use Supabase/Postgres.
"""

import json
import uuid
import random
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter

from app.config import BASE_DIR
from app.models.detection import (
    BoundingBox, DetectionRecord, DashboardStats, WildlifeSummary
)

STORE_FILE = BASE_DIR / "detections.json"

# Bird-related COCO class names that YOLO can detect
BIRD_CLASSES = {"bird"}

# Louisiana coastal habitat keywords for summary generation
HABITAT_TYPES = ["Marsh", "Barrier Island", "Swamp", "Open Water"]

# Louisiana coastline bounding box for random coordinate generation
LA_LAT_RANGE = (29.0, 30.0)
LA_LNG_RANGE = (-93.0, -89.0)


class DetectionStore:
    """In-memory store backed by a JSON file."""

    def __init__(self) -> None:
        self._records: list[DetectionRecord] = []
        self._load()

    def _load(self) -> None:
        """Load records from disk."""
        if STORE_FILE.exists():
            try:
                data = json.loads(STORE_FILE.read_text())
                self._records = [DetectionRecord(**r) for r in data]
            except Exception as e:
                print(f"[PelicanEye] Warning: could not load store: {e}")
                self._records = []

    def _save(self) -> None:
        """Persist records to disk."""
        STORE_FILE.write_text(
            json.dumps([r.model_dump() for r in self._records], indent=2)
        )

    def summarize_detections(self, boxes: list[BoundingBox]) -> WildlifeSummary:
        """
        Convert raw YOLO bounding boxes into a wildlife summary.
        Maps COCO class names to ecological descriptions.
        """
        if not boxes:
            return WildlifeSummary(
                species="No species detected",
                count=0,
                confidence=0.0,
                habitatType=random.choice(HABITAT_TYPES),
                nestingDetected=False,
                notes="No objects were detected in this image.",
            )

        # Count classes
        class_counts = Counter(b.class_name for b in boxes)
        most_common_class, most_common_count = class_counts.most_common(1)[0]
        avg_confidence = sum(b.confidence for b in boxes) / len(boxes)

        # Check if birds are present
        bird_count = sum(c for name, c in class_counts.items() if name in BIRD_CLASSES)
        has_birds = bird_count > 0

        # Generate ecological summary
        species_name = most_common_class.title()
        if has_birds:
            species_name = "Brown Pelican"  # Default Louisiana bird

        # Build notes
        all_classes = ", ".join(f"{name} ({count})" for name, count in class_counts.items())
        notes = f"Detected {len(boxes)} object(s): {all_classes}."
        if has_birds:
            notes += f" {bird_count} avian subject(s) identified in survey frame."

        # Generate threats based on detected objects
        threats: list[str] = []
        non_bird_classes = {n for n in class_counts if n not in BIRD_CLASSES}
        if "boat" in non_bird_classes or "ship" in non_bird_classes:
            threats.append("Marine vessel disturbance")
        if "person" in non_bird_classes:
            threats.append("Human encroachment")
        if "car" in non_bird_classes or "truck" in non_bird_classes:
            threats.append("Vehicle activity near habitat")

        return WildlifeSummary(
            species=species_name,
            count=len(boxes),
            confidence=round(avg_confidence, 3),
            habitatType=random.choice(HABITAT_TYPES),
            nestingDetected=has_birds and bird_count >= 3,
            notes=notes,
            threats=threats,
        )

    def add_record(
        self,
        boxes: list[BoundingBox],
        original_image_url: str,
        annotated_image_url: str,
        summary: WildlifeSummary,
    ) -> DetectionRecord:
        """Create and store a new detection record."""
        record = DetectionRecord(
            id=uuid.uuid4().hex[:12],
            species=summary.species,
            count=summary.count,
            confidence=summary.confidence,
            habitatType=summary.habitatType,
            nestingDetected=summary.nestingDetected,
            notes=summary.notes,
            threats=summary.threats,
            lat=round(random.uniform(*LA_LAT_RANGE), 4),
            lng=round(random.uniform(*LA_LNG_RANGE), 4),
            timestamp=datetime.now(timezone.utc).isoformat(),
            imageUrl=original_image_url,
            annotatedImageUrl=annotated_image_url,
            boundingBoxes=boxes,
        )
        self._records.insert(0, record)
        self._save()
        return record

    def get_all(self) -> list[DetectionRecord]:
        """Return all detection records, newest first."""
        return list(self._records)

    def get_stats(self) -> DashboardStats:
        """Aggregate statistics across all records."""
        all_species = set()
        total_nests = 0

        for r in self._records:
            all_species.add(r.species)
            if r.nestingDetected:
                total_nests += r.count

        return DashboardStats(
            totalImages=len(self._records),
            totalDetections=sum(r.count for r in self._records),
            nestsDetected=total_nests,
            speciesCount=len(all_species),
            speciesList=sorted(all_species),
            landLossAlerts=2,  # Static for prototype
        )


# Global singleton
detection_store = DetectionStore()
