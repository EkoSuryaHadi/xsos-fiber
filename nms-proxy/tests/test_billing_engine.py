"""
Unit & Simulation tests for Billing Rating Engine.
Memvalidasi kalkulasi sewa port, jam BoD, dan pemotongan penalti SLA pada tagihan.
"""
import pytest
from app.services.billing_engine import (
    preview_tenant_invoice,
    generate_tenant_invoice,
    generate_all_monthly_invoices,
)
from app.db.session import SessionLocal
from app.db.models import OutageIncident, Circuit, Tenant
from app.db.seed import init_db_and_seed
from datetime import datetime, timezone
import uuid


def test_billing_rating_basic():
    init_db_and_seed()
    db = SessionLocal()
    try:
        preview = preview_tenant_invoice("TNT-001", "October 2026", db)
        assert preview["tenant_id"] == "TNT-001"
        assert preview["base_port_fee"] == 14400.0
        assert preview["subtotal"] >= preview["base_port_fee"]
        assert preview["tax_amount"] == round(preview["subtotal"] * 0.11, 2)
        assert preview["total_due"] == round(preview["subtotal"] + preview["tax_amount"], 2)
    finally:
        db.close()


def test_billing_accuracy_simulation_platinum_45min():
    """
    SDLC QA Requirement:
    Memvalidasi kalkulasi tagihan dengan simulasi outage 45 menit pada sirkuit SLA Platinum (Bank Mandiri),
    memastikan nilai kompensasi penalti tepat memotong total tagihan.
    """
    init_db_and_seed()
    db = SessionLocal()
    try:
        # 1. Temukan sirkuit Bank Mandiri (TNT-003, Platinum)
        tenant_id = "TNT-003"
        circuit = db.query(Circuit).filter(Circuit.tenant_id == tenant_id).first()
        assert circuit is not None

        # Hapus data uji lama jika ada
        db.query(OutageIncident).filter(OutageIncident.circuit_id == circuit.id, OutageIncident.id.like("TEST-OUTAGE%")).delete()
        db.commit()

        # 2. Catat insiden outage 45 menit (45 * 60 = 2700 detik)
        test_incident = OutageIncident(
            id=f"TEST-OUTAGE-45M-{uuid.uuid4().hex[:6]}",
            circuit_id=circuit.id,
            severity="Critical",
            started_at=datetime.now(timezone.utc),
            resolved_at=datetime.now(timezone.utc),
            duration_seconds=45 * 60,
            root_cause="QA Automated Verification: Platinum Outage 45-Min",
        )
        db.add(test_incident)
        db.commit()

        # 3. Jalankan kalkulasi invoice
        preview = preview_tenant_invoice(tenant_id, "October 2026", db)

        # Base fee Bank Mandiri: $8,800.0
        # Platinum target: 99.999%, toleransi downtime: 0.432 min, rate: $35/min
        # Penalti = (45 - 0.432) * $35 = 44.568 * 35 = $1,559.88
        expected_penalty = 1559.88
        assert preview["sla_outage_downtime_min"] >= 45
        assert preview["sla_penalty_credit"] == expected_penalty

        # Subtotal harus terpotong penalti
        expected_subtotal = round(8800.0 - expected_penalty, 2)
        assert preview["subtotal"] == expected_subtotal
        expected_tax = round(expected_subtotal * 0.11, 2)
        assert preview["tax_amount"] == expected_tax
        assert preview["total_due"] == round(expected_subtotal + expected_tax, 2)

        # 4. Generate invoice resmi
        invoice = generate_tenant_invoice(tenant_id, "October 2026", db)
        assert invoice.sla_penalty_credit == expected_penalty
        assert invoice.total_due == preview["total_due"]
    finally:
        db.close()


def test_batch_generate_all():
    init_db_and_seed()
    db = SessionLocal()
    try:
        invoices = generate_all_monthly_invoices("November 2026", db)
        assert len(invoices) >= 6
        for inv in invoices:
            assert inv.total_due > 0
            assert inv.status == "Issued"
    finally:
        db.close()
