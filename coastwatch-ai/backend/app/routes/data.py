"""
PelicanEye - Data Routes

Endpoints for fetching detection history, stats, and data exports.
"""

import csv
import io
import json

from fastapi import APIRouter
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
async def export_csv():
    """Export all detection records as CSV."""
    records = detection_store.get_all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "species", "count", "confidence", "habitatType",
        "nestingDetected", "threats", "lat", "lng", "timestamp", "notes"
    ])
    for r in records:
        writer.writerow([
            r.id, r.species, r.count, round(r.confidence, 3),
            r.habitatType, r.nestingDetected,
            "; ".join(r.threats), r.lat, r.lng, r.timestamp, r.notes
        ])

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pelicaneye_detections.csv"},
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
