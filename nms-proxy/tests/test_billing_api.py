"""
Integration tests for Billing Engine REST API endpoints:
- POST /business/billing/generate-all
- GET/POST /business/billing/preview/{tenant_id}
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import get_settings

settings = get_settings()
client = TestClient(app)
HEADERS = {"X-API-Key": settings.proxy_api_key}


def test_billing_preview_endpoint():
    # Mengambil preview rating untuk tenant TNT-003 (Telkomsel)
    res = client.get("/business/billing/preview/TNT-003?billing_period=October 2026", headers=HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["tenant_id"] == "TNT-003"
    assert "Bank Mandiri" in data["tenant_name"]
    assert data["base_port_fee"] > 0
    assert "subtotal" in data
    assert "tax_amount" in data
    assert "total_due" in data
    assert data["total_due"] == round(data["subtotal"] + data["tax_amount"], 2)


def test_billing_preview_not_found():
    res = client.get("/business/billing/preview/TNT-9999", headers=HEADERS)
    assert res.status_code == 404


def test_billing_batch_generate_all():
    res = client.post("/business/billing/generate-all?billing_period=November 2026", headers=HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    for inv in data:
        assert inv["billing_period"] == "November 2026"
        assert inv["subtotal"] >= 0
        assert inv["total_due"] >= 0
        assert inv["status"] == "Issued"
