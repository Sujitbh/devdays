"""
PelicanEye - Operational Recommendation Engine

Maps alert context to field-ready conservation actions used in seabird and
coastal habitat management workflows.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class OperationalRecommendation:
    threat_detected: str
    trigger_condition: str
    recommended_action: str
    reasoning: str
    priority_level: str
    estimated_response_time: str
    responsible_agency: str
    expected_impact: str
    ai_driven: bool = False


# Catalog: field-ready action library for agency workflows.
RECOMMENDATION_CATALOG: list[OperationalRecommendation] = [
    OperationalRecommendation(
        threat_detected="Predator Presence",
        trigger_condition="Predator class detected near active nests or chicks.",
        recommended_action="Deploy predator exclosure at colony perimeter and start targeted trapping under permit.",
        reasoning="Predator control and exclusion are proven to reduce nest depredation in ground-nesting seabird colonies.",
        priority_level="Critical",
        estimated_response_time="Immediate",
        responsible_agency="LDWF Wildlife Biologist Team",
        expected_impact="Higher nest survival and improved fledging success this breeding cycle.",
    ),
    OperationalRecommendation(
        threat_detected="Nest Abandonment",
        trigger_condition="Nest inactive detections rise rapidly with ongoing adult presence.",
        recommended_action="Run 24-hour disturbance audit and apply temporary access closure around core nest polygons.",
        reasoning="Abandonment often follows disturbance pulses; early closure and patrols can stabilize attendance.",
        priority_level="Critical",
        estimated_response_time="Immediate",
        responsible_agency="LDWF + Refuge Site Manager",
        expected_impact="Reduced abandonment trend and preservation of active nests.",
    ),
    OperationalRecommendation(
        threat_detected="Colony Density Collapse",
        trigger_condition="Colony density drops more than 40 percent from recent baseline.",
        recommended_action="Trigger incident workflow and dispatch rapid field verification plus 72-hour re-survey.",
        reasoning="Large abrupt declines can indicate predation, disturbance, or habitat failure and require rapid diagnosis.",
        priority_level="Critical",
        estimated_response_time="24 hrs",
        responsible_agency="LDWF Incident Response Team",
        expected_impact="Faster root-cause identification and earlier corrective action.",
    ),
    OperationalRecommendation(
        threat_detected="Flood Risk",
        trigger_condition="Flood or inundation signals overlap active nesting areas.",
        recommended_action="Prioritize vulnerable nest patches for temporary elevation protection and increase monitoring cadence.",
        reasoning="Short inundation events can wipe out ground nests; rapid mitigation reduces egg and chick loss.",
        priority_level="Critical",
        estimated_response_time="Immediate",
        responsible_agency="LDWF + CPRA Coordination",
        expected_impact="Lower flood-related reproductive loss during surge windows.",
    ),
    OperationalRecommendation(
        threat_detected="Human Disturbance",
        trigger_condition="Person, vessel, or vehicle detections repeatedly enter nesting buffer.",
        recommended_action="Enforce 300m breeding-season exclusion zone and install temporary closure signage.",
        reasoning="Disturbance causes flush events and exposure of eggs/chicks, reducing nesting success.",
        priority_level="High",
        estimated_response_time="24 hrs",
        responsible_agency="LDWF Enforcement Unit",
        expected_impact="Reduced disturbance frequency and improved nest attendance.",
    ),
    OperationalRecommendation(
        threat_detected="Habitat Erosion",
        trigger_condition="Habitat erosion signatures detected adjacent to colony edge.",
        recommended_action="Submit site to shoreline stabilization queue and deploy interim attenuation materials where permitted.",
        reasoning="Erosion shrinks nesting footprint and raises storm vulnerability; early stabilization improves persistence.",
        priority_level="High",
        estimated_response_time="3 days",
        responsible_agency="CPRA Restoration Team",
        expected_impact="Slower habitat loss and more stable nesting substrate.",
    ),
    OperationalRecommendation(
        threat_detected="Oil Contamination",
        trigger_condition="Oil sheen or slick class detected in or near colony habitat.",
        recommended_action="Activate spill notification protocol, establish exclusion perimeter, and begin exposure surveillance.",
        reasoning="Hydrocarbon exposure drives direct mortality and breeding failure; response speed is critical.",
        priority_level="Critical",
        estimated_response_time="Immediate",
        responsible_agency="LDEQ + USCG + LDWF",
        expected_impact="Lower wildlife exposure and faster contamination containment.",
    ),
    OperationalRecommendation(
        threat_detected="Chick Mortality Increase",
        trigger_condition="Chick detections decline while active nest detections remain high.",
        recommended_action="Dispatch wildlife health team for disease and stress assessment and reduce disturbance in colony core.",
        reasoning="Chick-stage losses often signal acute stressors that require health diagnostics and immediate protection.",
        priority_level="Critical",
        estimated_response_time="24 hrs",
        responsible_agency="LDWF Wildlife Health Partners",
        expected_impact="Improved chick survival and reduced cohort loss.",
    ),
    OperationalRecommendation(
        threat_detected="Invasive Species Pressure",
        trigger_condition="Invasive herbivore or predator detections recur in marsh nesting zones.",
        recommended_action="Initiate integrated invasive control and replant native vegetation in damaged patches.",
        reasoning="Invasive pressure degrades habitat structure and increases nest exposure.",
        priority_level="High",
        estimated_response_time="3 days",
        responsible_agency="LDWF Invasive Control Team",
        expected_impact="Improved habitat quality and nesting cover.",
    ),
    OperationalRecommendation(
        threat_detected="Temperature Stress",
        trigger_condition="Heatwave conditions overlap chick-dominant colony stage.",
        recommended_action="Shift operations to dawn surveys, minimize on-foot disturbance, and increase mortality checks.",
        reasoning="Heat stress raises chick mortality risk; operational adjustments reduce additive stress.",
        priority_level="High",
        estimated_response_time="24 hrs",
        responsible_agency="Wildlife Biologist Field Team",
        expected_impact="Reduced heat-related chick mortality.",
    ),
    OperationalRecommendation(
        threat_detected="Foraging Stress",
        trigger_condition="Adult counts remain stable but chick output trends downward over surveys.",
        recommended_action="Coordinate prey-field assessment and prioritize intervention at colonies with best recovery potential.",
        reasoning="Low prey availability drives reproductive failure; integrated bird-prey assessment improves decision quality.",
        priority_level="Medium",
        estimated_response_time="1 week",
        responsible_agency="LDWF + Fisheries Partners",
        expected_impact="Better allocation of conservation resources and stronger fledging outcomes.",
    ),
    OperationalRecommendation(
        threat_detected="Chronic Access Corridor Disturbance",
        trigger_condition="Repeated alerts occur at same access route or landing point.",
        recommended_action="Harden access controls and reroute human traffic away from active breeding sectors.",
        reasoning="Persistent corridor use creates repeated disturbance pulses; rerouting lowers chronic stress.",
        priority_level="High",
        estimated_response_time="3 days",
        responsible_agency="Site Manager + LDWF Enforcement",
        expected_impact="Sustained decline in repeated disturbance alerts.",
    ),
    OperationalRecommendation(
        threat_detected="Multi-threat Co-occurrence",
        trigger_condition="Three or more major threat categories detected in one monitoring window.",
        recommended_action="Activate multi-agency incident command with daily action briefings and owner-based tasking.",
        reasoning="Compound stressors interact and can accelerate collapse if managed in isolated silos.",
        priority_level="Critical",
        estimated_response_time="Immediate",
        responsible_agency="LDWF Incident Command + Partners",
        expected_impact="Faster stabilization and lower probability of colony failure.",
    ),
    OperationalRecommendation(
        threat_detected="Habitat Suitability Decline",
        trigger_condition="Site-level habitat quality trend declines across multiple surveys.",
        recommended_action="Promote site into restoration design pipeline for sediment placement and living shoreline planning.",
        reasoning="Chronic degradation requires restoration actions beyond short-term enforcement.",
        priority_level="High",
        estimated_response_time="1 week",
        responsible_agency="CPRA + LDWF Habitat Planning",
        expected_impact="Improved long-term colony resilience.",
    ),
    OperationalRecommendation(
        threat_detected="Data Quality Drift",
        trigger_condition="Model confidence distribution shifts downward and anomaly rate increases.",
        recommended_action="Run QA sampling, label audit, and threshold hardening until recalibration is complete.",
        reasoning="Drift-aware quality control prevents false interventions and preserves trust in AI-assisted decisions.",
        priority_level="Medium",
        estimated_response_time="3 days",
        responsible_agency="PelicanEye ML Ops + LDWF Analytics",
        expected_impact="Higher precision and reduced false-positive burden.",
    ),
    # AI-driven recommendations
    OperationalRecommendation(
        threat_detected="Predictive Colony Health Decline",
        trigger_condition="Forecast model predicts health score drop >20 points in 14 days.",
        recommended_action="Pre-stage mitigation resources and schedule proactive field inspection before decline onset.",
        reasoning="Early intervention is more effective than reactive intervention after nest failure begins.",
        priority_level="Critical",
        estimated_response_time="24 hrs",
        responsible_agency="LDWF Science + Field Operations",
        expected_impact="Prevention of avoidable colony decline.",
        ai_driven=True,
    ),
    OperationalRecommendation(
        threat_detected="Automated Re-survey Trigger",
        trigger_condition="Low confidence detections or high-risk alert with no confirmation.",
        recommended_action="Auto-schedule confirmation survey at 24 hours and trend survey at 72 hours.",
        reasoning="Structured re-surveys reduce uncertainty and improve decision timing.",
        priority_level="High",
        estimated_response_time="Immediate",
        responsible_agency="UAS Operations Team",
        expected_impact="Faster confirmation and lower false-alarm persistence.",
        ai_driven=True,
    ),
    OperationalRecommendation(
        threat_detected="Spatiotemporal Anomaly",
        trigger_condition="Anomaly model flags unusual cluster fragmentation or synchronized stress across sites.",
        recommended_action="Issue regional risk bulletin and prioritize top anomalous sites for rapid verification.",
        reasoning="Anomaly signals can precede visible collapse and support proactive allocation.",
        priority_level="Critical",
        estimated_response_time="24 hrs",
        responsible_agency="LDWF Analytics + Regional Supervisors",
        expected_impact="Earlier intervention across at-risk colonies.",
        ai_driven=True,
    ),
]


def recommendation_to_dict(rec: OperationalRecommendation) -> dict[str, Any]:
    return {
        "threat_detected": rec.threat_detected,
        "trigger_condition": rec.trigger_condition,
        "recommended_action": rec.recommended_action,
        "reasoning": rec.reasoning,
        "priority_level": rec.priority_level,
        "estimated_response_time": rec.estimated_response_time,
        "responsible_agency": rec.responsible_agency,
        "expected_impact": rec.expected_impact,
        "ai_driven": rec.ai_driven,
    }


def match_recommendations_for_alert(alert: dict[str, Any]) -> list[dict[str, Any]]:
    """Return the most relevant operational recommendations for a given alert."""
    text = " ".join([
        str(alert.get("title", "")),
        str(alert.get("description", "")),
        str(alert.get("action", "")),
        str(alert.get("category", "")),
        str(alert.get("severity", "")),
    ]).lower()

    matches: list[OperationalRecommendation] = []

    keyword_rules = [
        (("predator", "feral", "raccoon", "coyote", "cat", "dog"), ["Predator Presence"]),
        (("abandon", "inactive nest", "nest inactivity"), ["Nest Abandonment"]),
        (("flood", "inundation", "surge"), ["Flood Risk"]),
        (("human", "boat", "vessel", "person", "vehicle", "disturb"), ["Human Disturbance", "Chronic Access Corridor Disturbance"]),
        (("erosion", "shoreline", "habitat loss"), ["Habitat Erosion", "Habitat Suitability Decline"]),
        (("oil", "sheen", "slick", "contamination"), ["Oil Contamination"]),
        (("chick", "mortality"), ["Chick Mortality Increase"]),
        (("invasive", "nutria"), ["Invasive Species Pressure"]),
        (("temperature", "heat", "thermal"), ["Temperature Stress"]),
        (("foraging", "prey"), ["Foraging Stress"]),
        (("collapse", "health score", "critical colony health"), ["Colony Density Collapse"]),
        (("multi", "compound", "multiple threats"), ["Multi-threat Co-occurrence"]),
        (("anomaly", "drift"), ["Data Quality Drift", "Spatiotemporal Anomaly"]),
    ]

    matched_titles: set[str] = set()
    for keywords, titles in keyword_rules:
        if any(k in text for k in keywords):
            for title in titles:
                matched_titles.add(title)

    if alert.get("severity") in {"Critical", "High"}:
        matched_titles.update({
            "Automated Re-survey Trigger",
            "Predictive Colony Health Decline",
        })

    for rec in RECOMMENDATION_CATALOG:
        if rec.threat_detected in matched_titles:
            matches.append(rec)

    if not matches:
        # Provide strong default playbook entries.
        defaults = [
            "Automated Re-survey Trigger",
            "Habitat Suitability Decline",
            "Data Quality Drift",
        ]
        for rec in RECOMMENDATION_CATALOG:
            if rec.threat_detected in defaults:
                matches.append(rec)

    # Limit payload size while keeping quality.
    return [recommendation_to_dict(r) for r in matches[:6]]


def get_recommendation_catalog() -> list[dict[str, Any]]:
    return [recommendation_to_dict(r) for r in RECOMMENDATION_CATALOG]
