"""
Integration tests for Business Layer REST API endpoints.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import get_settings

settings = get_settings()
client = TestClient(app)
API_KEY = settings.proxy_api_key
HEADERS = {"X-API-Key": API_KEY}


def test_auth_guard():
    # Tanpa X-API-Key wajib ditolak 401
    res = client.get("/business/overview")
    assert res.status_code == 401


def test_business_overview():
    res = client.get("/business/overview", headers=HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["total_tenants"] >= 6
    assert data["total_circuits"] >= 3
    assert data["total_invoiced_amount"] > 0


def test_tenants_crud():
    # 1. List tenants
    res = client.get("/business/tenants", headers=HEADERS)
    assert res.status_code == 200
    tenants = res.json()
    assert len(tenants) >= 6

    # 2. Detail tenant
    t_id = tenants[0]["id"]
    res_det = client.get(f"/business/tenants/{t_id}", headers=HEADERS)
    assert res_det.status_code == 200
    assert res_det.json()["id"] == t_id

    # 3. Create tenant
    new_tenant = {
        "id": "TNT-TEST-99",
        "name": "Equinix Cross Connect",
        "asn": 13335,
        "customer_type": "Enterprise",
        "contact_email": "noc@equinix.test",
        "rack_location": "MMR-A / R01-01",
        "contract_tier": "Platinum",
        "monthly_base_commit": 12500.0,
        "status": "Active",
    }
    res_create = client.post("/business/tenants", json=new_tenant, headers=HEADERS)
    assert res_create.status_code in [201, 400]  # 400 if already created in rerun


def test_bod_workflow():
    # 1. Get BoD requests
    res = client.get("/business/bod/requests", headers=HEADERS)
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 2

    # 2. Create BoD request
    new_bod = {
        "tenant_id": "TNT-001",
        "route": "MMR-A/R08 ──▶ Fabric-03",
        "source_panel": "XSOS-576D-1",
        "source_port": 50,
        "target_panel": "XSOS-576D-2",
        "target_port": 150,
        "capacity": "100G",
        "sla_tier": "Gold",
        "duration": "Temporary Burst (24h)",
        "insertion_loss_db": 0.42,
        "return_loss_db": -67.0,
        "est_switching_time_sec": 40,
        "monthly_cost": 1200.0,
    }
    res_post = client.post("/business/bod/requests", json=new_bod, headers=HEADERS)
    assert res_post.status_code == 201
    created = res_post.json()
    assert created["stage"] == 0
    bod_id = created["id"]

    # 3. Advance stage
    res_patch = client.patch(f"/business/bod/requests/{bod_id}/stage", json={"stage": 1}, headers=HEADERS)
    assert res_patch.status_code == 200
    assert res_patch.json()["stage"] == 1


def test_invoice_billing_engine():
    # 1. Get invoices
    res = client.get("/business/invoices", headers=HEADERS)
    assert res.status_code == 200
    inv_list = res.json()
    assert len(inv_list) >= 2

    # 2. Create invoice with calculation verification
    new_inv = {
        "tenant_id": "TNT-001",
        "billing_period": "October 2026",
        "base_port_fee": 10000.0,
        "bod_burst_usage_hours": 20.0,
        "bod_burst_rate_per_hour": 25.0,  # 20 * 25 = 500
        "bod_burst_total": 500.0,
        "sla_outage_downtime_min": 10,
        "sla_penalty_credit": 350.0,       # 10000 + 500 - 350 = 10150
        "status": "Issued",
        "due_date": "2026-11-15",
    }
    res_post = client.post("/business/invoices", json=new_inv, headers=HEADERS)
    assert res_post.status_code == 201
    created = res_post.json()
    assert created["subtotal"] == 10150.0
    assert created["tax_amount"] == 1116.5  # 10150 * 0.11 = 1116.5
    assert created["total_due"] == 11266.5   # 10150 + 1116.5 = 11266.5
    inv_id = created["id"]

    # 3. Update status to Paid
    res_patch = client.patch(f"/business/invoices/{inv_id}/status", json={"status": "Paid"}, headers=HEADERS)
    assert res_patch.status_code == 200
    assert res_patch.json()["status"] == "Paid"
