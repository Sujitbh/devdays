"""
PelicanEye - Alerts Routes

Endpoints for managing priority alerts.
"""

from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Query, HTTPException, Body
from pydantic import BaseModel

from app.services.alert_store import alert_store
from app.services.recommendation_engine import (
    match_recommendations_for_alert,
    get_recommendation_catalog,
)

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


class AlertRequest(BaseModel):
    """Request model for creating an alert."""
    severity: str  # 'High', 'Medium', 'Low'
    category: str  # 'wildlife', 'habitat', 'threat', 'system'
    title: str
    location: str
    description: str
    action: str
    species: Optional[str] = None
    detectionId: Optional[str] = None


class AlertUpdate(BaseModel):
    """Request model for updating an alert."""
    resolved: Optional[bool] = None
    notes: Optional[str] = None


@router.get("")
async def list_alerts(
    severity: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    species: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(None),
):
    """Get all alerts with optional filtering."""
    if any([severity, category, species, resolved is not None]):
        alerts = alert_store.filter(severity=severity, category=category, species=species, resolved=resolved)
    else:
        alerts = alert_store.get_all()
    return alerts


@router.get("/{alert_id}")
async def get_alert(alert_id: str):
    """Get a single alert by ID."""
    alert = alert_store.get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.post("")
async def create_alert(alert_data: AlertRequest):
    """Create a new alert."""
    alert = alert_store.create(alert_data.dict())
    return alert


@router.put("/{alert_id}")
async def update_alert(alert_id: str, update_data: AlertUpdate):
    """Update an alert (e.g. mark as resolved)."""
    alert = alert_store.update(alert_id, update_data.dict(exclude_unset=True))
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str):
    """Delete/archive an alert."""
    if alert_store.delete(alert_id):
        return {"success": True, "message": f"Alert {alert_id} deleted"}
    raise HTTPException(status_code=404, detail="Alert not found")


@router.get("/stats/summary")
async def get_alert_stats():
    """Get alert summary statistics."""
    alerts = alert_store.get_all()
    
    severity_counts = {
        'Critical': len([a for a in alerts if a.get('severity') == 'Critical' and not a.get('resolved')]),
        'High': len([a for a in alerts if a.get('severity') == 'High' and not a.get('resolved')]),
        'Medium': len([a for a in alerts if a.get('severity') == 'Medium' and not a.get('resolved')]),
        'Low': len([a for a in alerts if a.get('severity') == 'Low' and not a.get('resolved')]),
    }
    
    category_counts = {}
    for alert in alerts:
        cat = alert.get('category', 'system')
        if not alert.get('resolved'):
            category_counts[cat] = category_counts.get(cat, 0) + 1
    
    return {
        'total': len([a for a in alerts if not a.get('resolved')]),
        'resolved': len([a for a in alerts if a.get('resolved')]),
        'by_severity': severity_counts,
        'by_category': category_counts,
        'newest_timestamp': alerts[0].get('timestamp') if alerts else None,
    }


@router.get("/{alert_id}/recommendations")
async def get_alert_recommendations(alert_id: str):
    """Get matched operational recommendations for one alert."""
    alert = alert_store.get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {
        "alert_id": alert_id,
        "recommendations": match_recommendations_for_alert(alert),
    }


@router.get("/recommendations/catalog")
async def get_recommendations_catalog():
    """Get complete recommendation catalog for dashboard/reference view."""
    return {
        "count": len(get_recommendation_catalog()),
        "recommendations": get_recommendation_catalog(),
    }
