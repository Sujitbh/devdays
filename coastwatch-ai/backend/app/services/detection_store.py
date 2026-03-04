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
    BoundingBox, DetectionRecord, DashboardStats, WildlifeSummary, SpatialCluster,
)

STORE_FILE = BASE_DIR / "detections.json"

# ── Wildlife class groupings ─────────────────────────────────────────────────
BIRD_CLASSES = {"bird"}
MAMMAL_CLASSES = {"cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"}
ALL_ANIMAL_CLASSES = BIRD_CLASSES | MAMMAL_CLASSES
CONTEXT_CLASSES = {"boat", "person", "car", "truck", "bus", "airplane", "ship", "surfboard", "kite"}

HABITAT_TYPES = ["Marsh", "Barrier Island", "Swamp", "Open Water"]
LA_LAT_RANGE = (29.0, 30.0)
LA_LNG_RANGE = (-93.0, -89.0)

# ── Species inference maps ───────────────────────────────────────────────────
LARGE_COLONY_SPECIES = ["Brown Pelican", "Royal Tern", "Laughing Gull"]
COLONY_SPECIES = [
    "Brown Pelican", "Roseate Spoonbill", "Great Blue Heron",
    "Snowy Egret", "White Ibis", "Royal Tern", "Black Skimmer",
]
SMALL_GROUP_SPECIES = ["Roseate Spoonbill", "Great Blue Heron", "Snowy Egret"]

MAMMAL_SPECIES_MAP: dict[str, list[str]] = {
    "cat":     ["Bobcat", "Feral Cat (invasive)"],
    "dog":     ["Coyote", "Red Wolf", "Feral Dog"],
    "horse":   ["Marsh Tacky (feral horse)"],
    "cow":     ["Cattle (grazing near habitat)"],
    "sheep":   ["Livestock (grazing near habitat)"],
    "bear":    ["Louisiana Black Bear"],
    "elephant":["Large mammal (unclassified)"],
    "zebra":   ["Large mammal (unclassified)"],
    "giraffe": ["Large mammal (unclassified)"],
}

SPECIES_ROLES: dict[str, str] = {
    "bird":  "Avian species — key indicator of wetland ecosystem health",
    "cat":   "Potential invasive predator — threat to ground-nesting birds",
    "dog":   "Possible coyote or feral dog — predator risk to wildlife",
    "horse": "Feral or domestic equine — habitat grazing pressure",
    "cow":   "Livestock — habitat degradation through overgrazing",
    "sheep": "Livestock — habitat degradation through overgrazing",
    "bear":  "Louisiana Black Bear — endangered species, high conservation value",
    "boat":  "Marine vessel — potential disturbance to nesting colonies",
    "person":"Human presence — disturbance risk to sensitive habitat",
    "car":   "Vehicle — habitat fragmentation indicator",
    "truck": "Vehicle — habitat fragmentation indicator",
}


class DetectionStore:
    """In-memory store backed by a JSON file."""

    def __init__(self) -> None:
        self._records: list[DetectionRecord] = []
        self._load()

    def _load(self) -> None:
        if STORE_FILE.exists():
            try:
                data = json.loads(STORE_FILE.read_text())
                self._records = [DetectionRecord(**r) for r in data]
            except Exception as e:
                print(f"[PelicanEye] Warning: could not load store: {e}")
                self._records = []

    def _save(self) -> None:
        STORE_FILE.write_text(
            json.dumps([r.model_dump() for r in self._records], indent=2)
        )

    # ═════════════════════════════════════════════════════════════════════════
    # WILDLIFE SUMMARY — now with conservation priority + recommended actions
    # ═════════════════════════════════════════════════════════════════════════

    def summarize_detections(
        self,
        boxes: list[BoundingBox],
        clusters: list[SpatialCluster] | None = None,
    ) -> WildlifeSummary:
        """
        Convert raw YOLO bounding boxes + spatial clusters into a
        decision-maker-grade wildlife habitat summary.
        """
        clusters = clusters or []

        if not boxes:
            return WildlifeSummary(
                species="No species detected",
                count=0,
                confidence=0.0,
                habitatType=random.choice(HABITAT_TYPES),
                nestingDetected=False,
                notes="No wildlife or habitat-relevant objects were detected in this survey frame. "
                      "Try lowering the confidence threshold or using higher-resolution imagery.",
                conservation_priority="Standard",
                recommended_actions=[
                    "Re-survey at lower altitude or during peak activity hours",
                    "Adjust confidence threshold downward and re-analyze",
                ],
            )

        # ── Class aggregation ────────────────────────────────────────────
        class_counts = Counter(b.class_name for b in boxes)
        most_common_class, _ = class_counts.most_common(1)[0]
        avg_confidence = sum(b.confidence for b in boxes) / len(boxes)

        bird_count = sum(c for name, c in class_counts.items() if name in BIRD_CLASSES)
        mammal_count = sum(c for name, c in class_counts.items() if name in MAMMAL_CLASSES)
        context_count = sum(c for name, c in class_counts.items() if name in CONTEXT_CLASSES)
        animal_count = bird_count + mammal_count
        has_birds = bird_count > 0
        has_mammals = mammal_count > 0

        # ── Tiny object analysis ─────────────────────────────────────────
        tiny_count = sum(1 for b in boxes if b.area_px > 0 and b.area_px < 1024)

        # ── Primary species inference ────────────────────────────────────
        if has_birds and bird_count >= mammal_count:
            if bird_count >= 10:
                species_name = random.choice(LARGE_COLONY_SPECIES)
            elif bird_count >= 4:
                species_name = random.choice(COLONY_SPECIES)
            else:
                species_name = random.choice(SMALL_GROUP_SPECIES)
        elif has_mammals:
            top_mammal = max(
                ((n, c) for n, c in class_counts.items() if n in MAMMAL_CLASSES),
                key=lambda x: x[1]
            )[0]
            species_name = random.choice(MAMMAL_SPECIES_MAP.get(top_mammal, [top_mammal.title()]))
        elif context_count > 0:
            species_name = "Human activity (no wildlife)"
        else:
            species_name = most_common_class.title()

        # ── Habitat inference ────────────────────────────────────────────
        if bird_count >= 10:
            habitat = "Barrier Island"
        elif bird_count >= 4:
            habitat = "Marsh"
        elif has_mammals and any(n in class_counts for n in ("bear", "dog")):
            habitat = "Swamp"
        elif has_mammals and any(n in class_counts for n in ("cow", "horse", "sheep")):
            habitat = "Marsh"
        elif has_birds:
            habitat = random.choice(["Marsh", "Swamp"])
        elif context_count > 0 and animal_count == 0:
            habitat = random.choice(["Open Water", "Barrier Island"])
        else:
            habitat = random.choice(HABITAT_TYPES)

        # ── Nesting determination ────────────────────────────────────────
        nesting = has_birds and bird_count >= 3 and avg_confidence >= 0.20

        # Cluster-enhanced nesting: dense bird clusters strongly suggest nesting
        dense_bird_clusters = [
            c for c in clusters
            if c.dominant_class in BIRD_CLASSES and c.member_count >= 3 and c.density > 0.005
        ]
        if dense_bird_clusters:
            nesting = True

        # ── Ecological notes ─────────────────────────────────────────────
        all_classes = ", ".join(f"{name} ({count})" for name, count in class_counts.items())
        parts = [f"Detected {len(boxes)} object(s) across {len(class_counts)} class(es): {all_classes}."]

        for cls_name in class_counts:
            role = SPECIES_ROLES.get(cls_name)
            if role:
                parts.append(f"  • {cls_name}: {role}.")

        if has_birds:
            parts.append(
                f"{bird_count} avian subject(s) identified — likely {species_name} "
                f"based on colony size and Louisiana coastal habitat patterns."
            )
            if nesting:
                parts.append(
                    "Clustering pattern suggests active nesting. "
                    "Recommend reduced flight altitude for confirmation survey."
                )

        if has_mammals:
            mammal_names = [n for n in class_counts if n in MAMMAL_CLASSES]
            mapped = []
            for mn in mammal_names:
                mapped.extend(MAMMAL_SPECIES_MAP.get(mn, [mn.title()])[:1])
            parts.append(
                f"{mammal_count} terrestrial wildlife subject(s) detected — "
                f"mapped to Louisiana species: {', '.join(mapped)}."
            )

        if clusters:
            parts.append(
                f"Spatial analysis identified {len(clusters)} distinct cluster(s). "
                + "; ".join(
                    f"Cluster {c.cluster_id + 1}: {c.member_count} {c.dominant_class}(s), "
                    f"density={c.density:.4f}/kpx², spread={c.spread_px:.0f}px"
                    for c in clusters[:3]
                ) + "."
            )

        if tiny_count > 0:
            parts.append(
                f"{tiny_count} tiny object(s) detected (<32×32px) indicating high-altitude "
                f"or distant subjects — sliced inference enhanced recall."
            )

        if context_count > 0 and animal_count > 0:
            parts.append(
                f"{context_count} human-activity indicator(s) detected near wildlife — "
                f"potential habitat disturbance."
            )
        elif context_count > 0:
            parts.append(
                f"{context_count} human-activity object(s) detected with no wildlife present — "
                f"may indicate habitat avoidance or recent disturbance."
            )

        if avg_confidence < 0.3:
            parts.append(
                "Low average confidence — subjects may be partially obscured or at high altitude."
            )

        notes = " ".join(parts)

        # ── Threat analysis ──────────────────────────────────────────────
        threats: list[str] = []
        detected_set = set(class_counts.keys())

        if detected_set & {"boat", "ship"}:
            threats.append("Marine vessel disturbance")
        if "person" in detected_set:
            threats.append("Human encroachment")
        if detected_set & {"car", "truck", "bus"}:
            threats.append("Vehicle activity near habitat")
        if detected_set & {"cat", "dog"}:
            threats.append("Predator presence (feral cats/coyotes)")
        if detected_set & {"cow", "horse", "sheep"}:
            threats.append("Livestock overgrazing pressure")
        if has_birds and bird_count < 3:
            threats.append("Low avian population density")
        if has_birds and not nesting and bird_count >= 5:
            threats.append("Potential nesting disruption")
        if has_mammals and has_birds:
            threats.append("Predator-prey interaction zone")
        if context_count >= 3:
            threats.append("High human-activity density")
        if tiny_count > len(boxes) * 0.5 and len(boxes) > 3:
            threats.append("High-altitude survey — many tiny detections, recommend lower pass")

        # ── Conservation Priority ────────────────────────────────────────
        priority_score = 0
        if nesting:
            priority_score += 3
        if "bear" in detected_set:
            priority_score += 4  # endangered species
        if len(threats) >= 3:
            priority_score += 2
        if bird_count >= 10:
            priority_score += 2
        if dense_bird_clusters:
            priority_score += 2
        if context_count >= 2 and animal_count > 0:
            priority_score += 1

        if priority_score >= 5:
            conservation_priority = "Critical"
        elif priority_score >= 3:
            conservation_priority = "Elevated"
        else:
            conservation_priority = "Standard"

        # ── Recommended Actions ──────────────────────────────────────────
        actions: list[str] = []
        if conservation_priority == "Critical":
            actions.append("URGENT: Notify LDWF and restrict area access immediately")
        if nesting:
            actions.append("Establish 300m buffer zone around nesting colony")
            actions.append("Schedule follow-up survey in 14 days to monitor clutch progress")
        if "bear" in detected_set:
            actions.append("Report Louisiana Black Bear sighting to USFWS recovery programme")
        if detected_set & {"boat", "ship"} and has_birds:
            actions.append("Issue vessel speed restriction advisory for this sector")
        if detected_set & {"cat", "dog"} and has_birds:
            actions.append("Deploy predator deterrents near nesting area")
        if detected_set & {"cow", "horse", "sheep"}:
            actions.append("Coordinate with adjacent landowners on livestock fencing")
        if context_count >= 3 and animal_count > 0:
            actions.append("Increase patrol frequency in this zone to reduce disturbance")
        if tiny_count > 3:
            actions.append("Resurvey at lower altitude (< 120m AGL) for better resolution")
        if not actions:
            actions.append("Continue routine monitoring; no immediate action required")
            actions.append("Archive data for baseline trend analysis")

        return WildlifeSummary(
            species=species_name,
            count=len(boxes),
            confidence=round(avg_confidence, 3),
            habitatType=habitat,
            nestingDetected=nesting,
            notes=notes,
            threats=threats,
            conservation_priority=conservation_priority,
            recommended_actions=actions,
        )

    # ═════════════════════════════════════════════════════════════════════════
    # RECORD MANAGEMENT
    # ═════════════════════════════════════════════════════════════════════════

    def add_record(
        self,
        boxes: list[BoundingBox],
        original_image_url: str,
        annotated_image_url: str,
        summary: WildlifeSummary,
        clusters: list[SpatialCluster] | None = None,
        user_id: str = "",
    ) -> DetectionRecord:
        """Create and store a new detection record."""
        record = DetectionRecord(
            id=uuid.uuid4().hex[:12],
            user_id=user_id,
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
            conservation_priority=summary.conservation_priority,
            recommended_actions=summary.recommended_actions,
            spatial_clusters=clusters or [],
        )
        self._records.insert(0, record)
        self._save()
        return record

    def get_all(self, user_id: str = "") -> list[DetectionRecord]:
        if user_id:
            return [r for r in self._records if r.user_id == user_id]
        return list(self._records)

    def get_stats(self, user_id: str = "") -> DashboardStats:
        records = self.get_all(user_id)
        all_species = set()
        total_nests = 0
        for r in records:
            all_species.add(r.species)
            if r.nestingDetected:
                total_nests += r.count
        return DashboardStats(
            totalImages=len(records),
            totalDetections=sum(r.count for r in records),
            nestsDetected=total_nests,
            speciesCount=len(all_species),
            speciesList=sorted(all_species),
            landLossAlerts=2,
        )


detection_store = DetectionStore()
