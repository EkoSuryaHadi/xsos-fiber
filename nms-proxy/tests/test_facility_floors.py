"""
Tests for Facility Floors (Datacenter Layout) API endpoints.
"""
from fastapi.testclient import TestClient

from app.main import app
from app.config import get_settings

settings = get_settings()
client = TestClient(app)
API_KEY = settings.proxy_api_key
HEADERS = {"X-API-Key": API_KEY}


def test_facility_floors_list():
    res = client.get("/business/facility/floors", headers=HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 5
    floor_ids = [f["id"] for f in data]
    assert "5th" in floor_ids
    assert "3rd-4th" in floor_ids
    assert "2nd" in floor_ids
    assert "1st" in floor_ids
    assert "ground" in floor_ids


def test_facility_floor_detail():
    res = client.get("/business/facility/floors/2nd", headers=HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "2nd"
    assert "MMR-A" in data["room"]
    assert data["total_fibers"] == 276
    assert "XSOS-576D" in data["xsos_units"]
    assert len(data["racks"]) > 0


def test_facility_floor_not_found():
    res = client.get("/business/facility/floors/10th", headers=HEADERS)
    assert res.status_code == 404
