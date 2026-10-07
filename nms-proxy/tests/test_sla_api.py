"""
Integration tests for SLA & Telemetry REST API endpoints.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import get_settings

settings = get_settings()
client = TestClient(app)
HEADERS = {"X-API-Key": settings.proxy_api_key}


def test_sla_compliance_endpoint():
    res = client.get("/business/sla/compliance", headers=HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 4
    # Memastikan format data
    for item in data:
        assert "customer_type" in item
        assert "uptime_target_pct" in item
        assert "actual_uptime_pct" in item
        assert "status" in item
        assert item["status"] in ["Good", "Watch", "Breach"]


def test_outage_incidents_flow():
    # 1. List incidents
    res = client.get("/business/sla/incidents", headers=HEADERS)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    # 2. Simulate Outage Incident
    sim_payload = {
        "circuit_id": "CKT-1001",
        "downtime_minutes": 25,
        "severity": "Critical",
        "root_cause": "Test Drill Fiber Cut",
    }
    res_sim = client.post("/business/sla/incidents/simulate", json=sim_payload, headers=HEADERS)
    assert res_sim.status_code == 201
    created = res_sim.json()
    assert created["duration_seconds"] == 25 * 60
    assert "Test Drill Fiber Cut" in created["root_cause"]
    incident_id = created["id"]

    # 3. Resolve Incident
    res_resolve = client.patch(f"/business/sla/incidents/{incident_id}/resolve", headers=HEADERS)
    assert res_resolve.status_code == 200
    resolved = res_resolve.json()
    assert resolved["resolved_at"] is not None


def test_telemetry_status_endpoint():
    res = client.get("/business/telemetry/status", headers=HEADERS)
    assert res.status_code == 200
    status = res.json()
    assert "is_running" in status
    assert "interval_seconds" in status
    assert "poll_count" in status
