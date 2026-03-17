"""
PelicanEye - Alerts Service

Manages alert storage, retrieval, and updates.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List
from uuid import uuid4

from app.config import BASE_DIR, SUPABASE_KEY, SUPABASE_URL, USE_SUPABASE
from app.services.supabase_client import get_supabase


class AlertStore:
    """Alert storage (Supabase when configured; otherwise JSON file)."""
    
    def __init__(self):
        self.alerts_file = BASE_DIR / "alerts.json"
        self._use_supabase = bool(USE_SUPABASE and SUPABASE_URL and SUPABASE_KEY)
        if not self._use_supabase:
            self._ensure_file()
    
    def _ensure_file(self):
        """Create alerts.json if it doesn't exist."""
        if not self.alerts_file.exists():
            self.alerts_file.write_text(json.dumps({"alerts": []}, indent=2))
    
    def _load(self) -> dict:
        """Load all alerts from file."""
        try:
            data = json.loads(self.alerts_file.read_text())
            return data.get("alerts", [])
        except Exception as e:
            print(f"Warning: Could not load alerts: {e}")
            return []
    
    def _save(self, alerts: list):
        """Save alerts to file."""
        self.alerts_file.write_text(json.dumps({"alerts": alerts}, indent=2))
    
    def get_all(self) -> list:
        """Get all alerts, newest first."""
        if self._use_supabase:
            sb = get_supabase()
            res = (
                sb.table("alerts")
                .select("*")
                .order("timestamp", desc=True)
                .execute()
            )
            return res.data or []

        alerts = self._load()
        return sorted(alerts, key=lambda a: a.get("timestamp", ""), reverse=True)
    
    def get(self, alert_id: str) -> Optional[dict]:
        """Get a single alert by ID."""
        if self._use_supabase:
            sb = get_supabase()
            res = sb.table("alerts").select("*").eq("id", alert_id).limit(1).execute()
            rows = res.data or []
            return rows[0] if rows else None

        alerts = self._load()
        return next((a for a in alerts if a["id"] == alert_id), None)
    
    def create(self, alert_data: dict) -> dict:
        """Create a new alert."""
        alert = {
            'id': str(uuid4()),
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'resolved': False,
            **alert_data
        }
        if self._use_supabase:
            sb = get_supabase()
            sb.table("alerts").insert(alert).execute()
            return alert

        alerts = self._load()
        alerts.append(alert)
        self._save(alerts)
        return alert
    
    def update(self, alert_id: str, updates: dict) -> Optional[dict]:
        """Update an alert's resolved status or other fields."""
        if self._use_supabase:
            safe_updates = {}
            if "resolved" in updates:
                safe_updates["resolved"] = updates["resolved"]
            if "notes" in updates:
                safe_updates["notes"] = updates["notes"]
            if not safe_updates:
                return self.get(alert_id)
            sb = get_supabase()
            res = (
                sb.table("alerts")
                .update(safe_updates)
                .eq("id", alert_id)
                .select("*")
                .limit(1)
                .execute()
            )
            rows = res.data or []
            return rows[0] if rows else None

        alerts = self._load()
        for alert in alerts:
            if alert["id"] == alert_id:
                if "resolved" in updates:
                    alert["resolved"] = updates["resolved"]
                if "notes" in updates:
                    alert["notes"] = updates["notes"]
                self._save(alerts)
                return alert
        return None
    
    def filter(self, severity: Optional[str] = None, category: Optional[str] = None,
               species: Optional[str] = None, resolved: Optional[bool] = None) -> list:
        """Filter alerts by criteria."""
        if self._use_supabase:
            sb = get_supabase()
            q = sb.table("alerts").select("*")
            if severity:
                q = q.eq("severity", severity)
            if category:
                q = q.eq("category", category)
            if species:
                q = q.ilike("species", species)
            if resolved is not None:
                q = q.eq("resolved", resolved)
            res = q.order("timestamp", desc=True).execute()
            return res.data or []

        alerts = self._load()

        if severity:
            alerts = [a for a in alerts if a.get("severity") == severity]
        if category:
            alerts = [a for a in alerts if a.get("category") == category]
        if species:
            alerts = [a for a in alerts if a.get("species", "").lower() == species.lower()]
        if resolved is not None:
            alerts = [a for a in alerts if a.get("resolved") == resolved]

        return sorted(alerts, key=lambda a: a.get("timestamp", ""), reverse=True)
    
    def delete(self, alert_id: str) -> bool:
        """Delete/archive an alert."""
        if self._use_supabase:
            sb = get_supabase()
            sb.table("alerts").delete().eq("id", alert_id).execute()
            return True

        alerts = self._load()
        original_len = len(alerts)
        alerts = [a for a in alerts if a["id"] != alert_id]
        if len(alerts) < original_len:
            self._save(alerts)
            return True
        return False


# Singleton instance
alert_store = AlertStore()
