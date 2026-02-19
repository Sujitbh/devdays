"""
PelicanEye - Data Routes

Endpoints for fetching detection history, stats, and data exports.
"""

import csv
import io
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.models.detection import DetectionRecord, DashboardStats
from app.services.detection_store import detection_store

router = APIRouter(prefix="/api", tags=["Data"])


@router.get("/detections", response_model=list[DetectionRecord])
async def list_detections():
    """Return all detection records, newest first."""
    return detection_store.get_all()


@router.get("/stats", response_model=DashboardStats)
async def get_stats():
    """Return aggregated dashboard statistics."""
    return detection_store.get_stats()


@router.get("/exports/csv")
async def export_csv(
    species: Optional[str] = Query(None, description="Filter by species (case-insensitive substring match)"),
    habitat: Optional[str] = Query(None, description="Filter by habitat type"),
    min_confidence: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum confidence threshold"),
    date_from: Optional[str] = Query(None, description="Start date (ISO format, e.g. 2025-01-01)"),
    date_to: Optional[str] = Query(None, description="End date (ISO format, e.g. 2025-12-31)"),
    include_boxes: bool = Query(False, description="Include individual bounding box rows"),
):
    """Export detection records as a comprehensive CSV report with optional filters."""
    records = detection_store.get_all()

    # ── Apply filters ────────────────────────────────────────────────
    if species:
        records = [r for r in records if species.lower() in r.species.lower()]
    if habitat:
        records = [r for r in records if habitat.lower() in r.habitatType.lower()]
    if min_confidence is not None:
        records = [r for r in records if r.confidence >= min_confidence]
    if date_from:
        records = [r for r in records if r.timestamp >= date_from]
    if date_to:
        records = [r for r in records if r.timestamp <= date_to + "T23:59:59"]

    output = io.StringIO()
    writer = csv.writer(output)

    # ── Metadata header rows ─────────────────────────────────────────
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    writer.writerow(["# PelicanEye - Louisiana Coastal Wildlife Monitoring Report"])
    writer.writerow([f"# Generated: {now}"])
    writer.writerow([f"# Total Records: {len(records)}"])
    filters_applied = []
    if species:
        filters_applied.append(f"species={species}")
    if habitat:
        filters_applied.append(f"habitat={habitat}")
    if min_confidence is not None:
        filters_applied.append(f"min_confidence={min_confidence}")
    if date_from:
        filters_applied.append(f"from={date_from}")
    if date_to:
        filters_applied.append(f"to={date_to}")
    writer.writerow([f"# Filters: {', '.join(filters_applied) if filters_applied else 'None'}"])
    writer.writerow([])  # blank separator

    # ── Column headers ───────────────────────────────────────────────
    headers = [
        "Record ID",
        "Species",
        "Detection Count",
        "Confidence (%)",
        "Habitat Type",
        "Nesting Detected",
        "Threat Level",
        "Threats",
        "Latitude",
        "Longitude",
        "Timestamp",
        "Ecological Notes",
        "Bounding Box Count",
        "Image URL",
        "Annotated Image URL",
    ]
    if include_boxes:
        headers.extend(["Box #", "Box Class", "Box Confidence (%)", "Box X1", "Box Y1", "Box X2", "Box Y2"])
    writer.writerow(headers)

    # ── Data rows ────────────────────────────────────────────────────
    total_animals = 0
    total_conf = 0.0
    threat_counter: dict[str, int] = {}
    species_counter: dict[str, int] = {}
    habitat_counter: dict[str, int] = {}

    for r in records:
        total_animals += r.count
        total_conf += r.confidence
        species_counter[r.species] = species_counter.get(r.species, 0) + r.count
        habitat_counter[r.habitatType] = habitat_counter.get(r.habitatType, 0) + 1
        for t in r.threats:
            threat_counter[t] = threat_counter.get(t, 0) + 1

        # Determine threat level
        num_threats = len(r.threats)
        threat_level = "None" if num_threats == 0 else "Low" if num_threats == 1 else "Medium" if num_threats <= 3 else "High"

        base_row = [
            r.id,
            r.species,
            r.count,
            f"{r.confidence * 100:.1f}",
            r.habitatType,
            "Yes" if r.nestingDetected else "No",
            threat_level,
            "; ".join(r.threats) if r.threats else "None identified",
            f"{r.lat:.6f}",
            f"{r.lng:.6f}",
            r.timestamp,
            r.notes or "",
            len(r.boundingBoxes),
            r.imageUrl,
            r.annotatedImageUrl,
        ]

        if include_boxes and r.boundingBoxes:
            for idx, box in enumerate(r.boundingBoxes, 1):
                writer.writerow(base_row + [
                    idx,
                    box.class_name,
                    f"{box.confidence * 100:.1f}",
                    f"{box.x1:.1f}",
                    f"{box.y1:.1f}",
                    f"{box.x2:.1f}",
                    f"{box.y2:.1f}",
                ])
        else:
            writer.writerow(base_row + ([""] * 7 if include_boxes else []))

    # ── Summary section ──────────────────────────────────────────────
    writer.writerow([])
    writer.writerow(["# ─── Summary Statistics ───"])
    writer.writerow(["Total Survey Images", len(records)])
    writer.writerow(["Total Wildlife Detections", total_animals])
    writer.writerow(["Average Confidence", f"{(total_conf / len(records) * 100):.1f}%" if records else "N/A"])
    writer.writerow(["Nesting Events", sum(1 for r in records if r.nestingDetected)])
    writer.writerow([])
    writer.writerow(["# ─── Species Breakdown ───"])
    for sp, count in sorted(species_counter.items(), key=lambda x: -x[1]):
        writer.writerow([sp, count])
    writer.writerow([])
    writer.writerow(["# ─── Habitat Distribution ───"])
    for hab, count in sorted(habitat_counter.items(), key=lambda x: -x[1]):
        writer.writerow([hab, count])
    writer.writerow([])
    writer.writerow(["# ─── Threat Frequency ───"])
    for thr, count in sorted(threat_counter.items(), key=lambda x: -x[1]):
        writer.writerow([thr, count])

    output.seek(0)

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"pelicaneye_report_{ts}.csv"

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/exports/geojson")
async def export_geojson():
    """Export all detection records as GeoJSON FeatureCollection."""
    records = detection_store.get_all()

    features = []
    for r in records:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [r.lng, r.lat],
            },
            "properties": {
                "id": r.id,
                "species": r.species,
                "count": r.count,
                "confidence": r.confidence,
                "habitatType": r.habitatType,
                "nestingDetected": r.nestingDetected,
                "threats": r.threats,
                "timestamp": r.timestamp,
                "notes": r.notes,
            },
        })

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    return StreamingResponse(
        io.BytesIO(json.dumps(geojson, indent=2).encode()),
        media_type="application/geo+json",
        headers={"Content-Disposition": "attachment; filename=pelicaneye_detections.geojson"},
    )
