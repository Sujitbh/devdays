"""
PelicanEye - Alerts Routes

Endpoints for managing priority alerts.
"""

import os
import logging
from typing import Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, Query, HTTPException, Body
from pydantic import BaseModel

from app.services.alert_store import alert_store
from app.services.recommendation_engine import (
    match_recommendations_for_alert,
    get_recommendation_catalog,
)

logger = logging.getLogger("pelicaneye.alerts")

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


class AlertMatchRequest(BaseModel):
    """Alert context for recommendation matching (no backend storage required)."""
    title: str = ""
    description: str = ""
    action: str = ""
    category: str = ""
    severity: str = ""
    species: Optional[str] = None


@router.post("/recommendations/match")
async def match_recommendations(alert_data: AlertMatchRequest):
    """Match recommendations directly from alert context without needing a stored alert."""
    return {
        "recommendations": match_recommendations_for_alert(alert_data.dict()),
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


# ── Notification ──────────────────────────────────────────────────────────────

class NotifyRequest(BaseModel):
    alert_id: str
    title: str
    severity: str
    location: str
    description: str
    action: str
    species: Optional[str] = None
    recipient_name: str = "LDWF Wildlife Monitoring Team"
    recipient_email: str = "monitoring@ldwf.louisiana.gov"
    sender_name: str = "PelicanEye CoastWatch AI"
    custom_message: Optional[str] = None


@router.post("/notify")
async def send_alert_notification(payload: NotifyRequest):
    """
    Send an alert notification to LDWF.
    Uses SendGrid if SENDGRID_API_KEY is set in env; otherwise logs a mock
    notification (demo-safe — always returns success).
    """
    timestamp = datetime.now(timezone.utc).isoformat()

    subject = f"[PelicanEye {payload.severity} Alert] {payload.title}"

    body = f"""
PelicanEye CoastWatch AI — Priority Alert Notification
{'=' * 60}

Severity    : {payload.severity}
Title       : {payload.title}
Location    : {payload.location}
Species     : {payload.species or 'N/A'}
Timestamp   : {timestamp}

DESCRIPTION
-----------
{payload.description}

RECOMMENDED ACTION
------------------
{payload.action}

{('ADDITIONAL NOTES' + chr(10) + '-' * 17 + chr(10) + payload.custom_message) if payload.custom_message else ''}

{'=' * 60}
This notification was generated automatically by PelicanEye.
Respond to this alert via the Priority Alerts dashboard.
""".strip()

    sendgrid_key = os.getenv("SENDGRID_API_KEY", "")

    if sendgrid_key:
        # Real send via SendGrid (only runs when key is configured)
        try:
            import httpx
            sg_payload = {
                "personalizations": [{"to": [{"email": payload.recipient_email, "name": payload.recipient_name}]}],
                "from": {"email": "alerts@pelicaneye.ai", "name": payload.sender_name},
                "subject": subject,
                "content": [{"type": "text/plain", "value": body}],
            }
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    headers={"Authorization": f"Bearer {sendgrid_key}", "Content-Type": "application/json"},
                    json=sg_payload,
                    timeout=10,
                )
            sent_via = "sendgrid"
            logger.info("📧 Alert notification sent via SendGrid to %s (status %d)", payload.recipient_email, resp.status_code)
        except Exception as e:
            logger.error("SendGrid send failed: %s — falling back to mock", e)
            sent_via = "mock"
    else:
        # Demo / mock mode — log it and return success
        sent_via = "mock"
        logger.info("📧 [MOCK] Alert notification for '%s' would be sent to %s", payload.title, payload.recipient_email)
        logger.info("Subject : %s", subject)
        logger.info("Body    :\n%s", body)

    return {
        "success": True,
        "sent_via": sent_via,
        "recipient": payload.recipient_email,
        "recipient_name": payload.recipient_name,
        "subject": subject,
        "timestamp": timestamp,
        "mock": sent_via == "mock",
    }
