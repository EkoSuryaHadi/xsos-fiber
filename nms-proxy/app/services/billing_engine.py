"""
Billing Rating Engine Service.
Mengakumulasikan sewa port tetap, pemakaian BoD temporer,
dan memotong kredit restitusi penalti SLA ke faktur komersial bulanan pelanggan.
"""
import uuid
from typing import Dict, Any, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func

try:
    from app.db.models import Tenant, Circuit, BodSession, OutageIncident, Invoice
    from app.services.sla_engine import calculate_sla_penalty
except (ImportError, ValueError):
    from db.models import Tenant, Circuit, BodSession, OutageIncident, Invoice
    from services.sla_engine import calculate_sla_penalty


def preview_tenant_invoice(
    tenant_id: str,
    billing_period: str,
    db: Session,
) -> Dict[str, Any]:
    """
    Menghitung simulasi faktur tagihan untuk tenant tertentu tanpa menyimpannya ke database.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise ValueError(f"Tenant dengan ID {tenant_id} tidak ditemukan")

    # 1. Base Recurring Port Fee
    base_fee = float(tenant.monthly_base_commit)

    # 2. Akumulasi BoD Usage
    bod_sessions = db.query(BodSession).filter(BodSession.tenant_id == tenant_id).all()
    burst_hours = 0.0
    burst_total = 0.0
    for s in bod_sessions:
        if s.duration != "Recurring":
            hours = 24.0 if "24h" in s.duration else 72.0 if "72h" in s.duration else 12.0
            rate = 25.0
            burst_hours += hours
            burst_total += hours * rate
        else:
            burst_total += float(s.monthly_cost)

    # 3. Akumulasi Outage & Pemotongan Penalti SLA
    circuits = db.query(Circuit).filter(Circuit.tenant_id == tenant_id).all()
    circuit_ids = [c.id for c in circuits]

    total_downtime_sec = 0
    if circuit_ids:
        downtime_sum = (
            db.query(func.coalesce(func.sum(OutageIncident.duration_seconds), 0))
            .filter(OutageIncident.circuit_id.in_(circuit_ids))
            .scalar()
        )
        total_downtime_sec = int(downtime_sum)

    total_downtime_min = round(total_downtime_sec / 60.0, 2)
    penalty_credit = calculate_sla_penalty(total_downtime_min, tenant.contract_tier)

    # 4. Kalkulasi Finansial Akhir
    subtotal = max(0.0, base_fee + burst_total - penalty_credit)
    tax_amount = round(subtotal * 0.11, 2)  # PPN 11%
    total_due = round(subtotal + tax_amount, 2)

    return {
        "tenant_id": tenant.id,
        "tenant_name": tenant.name,
        "asn": tenant.asn,
        "contract_tier": tenant.contract_tier,
        "billing_period": billing_period,
        "base_port_fee": base_fee,
        "bod_burst_usage_hours": burst_hours,
        "bod_burst_rate_per_hour": 25.0,
        "bod_burst_total": round(burst_total, 2),
        "sla_outage_downtime_min": int(total_downtime_min),
        "sla_penalty_credit": penalty_credit,
        "subtotal": round(subtotal, 2),
        "tax_amount": tax_amount,
        "total_due": total_due,
        "due_date": "2026-11-15",
    }


def generate_tenant_invoice(
    tenant_id: str,
    billing_period: str,
    db: Session,
) -> Invoice:
    """
    Menghasilkan dan menyimpan faktur komersial resmi ke database.
    """
    calc = preview_tenant_invoice(tenant_id, billing_period, db)
    invoice_id = f"INV-2026-{uuid.uuid4().hex[:4].upper()}"

    new_invoice = Invoice(
        id=invoice_id,
        tenant_id=calc["tenant_id"],
        billing_period=calc["billing_period"],
        base_port_fee=calc["base_port_fee"],
        bod_burst_usage_hours=calc["bod_burst_usage_hours"],
        bod_burst_rate_per_hour=calc["bod_burst_rate_per_hour"],
        bod_burst_total=calc["bod_burst_total"],
        sla_outage_downtime_min=calc["sla_outage_downtime_min"],
        sla_penalty_credit=calc["sla_penalty_credit"],
        subtotal=calc["subtotal"],
        tax_amount=calc["tax_amount"],
        total_due=calc["total_due"],
        status="Issued",
        due_date=calc["due_date"],
    )
    db.add(new_invoice)
    db.commit()
    db.refresh(new_invoice)
    return new_invoice


def generate_all_monthly_invoices(
    billing_period: str,
    db: Session,
) -> List[Invoice]:
    """
    Batch Billing Job: Mengotomasi kalkulasi rating untuk seluruh tenant aktif.
    """
    tenants = db.query(Tenant).filter(Tenant.status == "Active").all()
    created_invoices = []
    for t in tenants:
        inv = generate_tenant_invoice(t.id, billing_period, db)
        created_invoices.append(inv)
    return created_invoices
