"""
REST API Router untuk Business Layer IXP Orchestration & BSS/OSS.
Prefix: /business
"""
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

try:
    from app.db.session import get_db
    from app.db.models import Tenant, SlaPolicy, Circuit, BodSession, Invoice, OutageIncident
    from app.db.schemas import (
        BusinessOverviewResponse,
        TenantResponse,
        TenantCreate,
        CircuitResponse,
        CircuitCreate,
        SlaPolicyResponse,
        BodRequestResponse,
        BodRequestCreate,
        BodRequestUpdateStage,
        InvoiceResponse,
        InvoiceCreate,
        InvoiceStatusUpdate,
        SlaComplianceRecordResponse,
        OutageIncidentResponse,
        OutageIncidentCreate,
        SimulateIncidentRequest,
        TelemetryStatusResponse,
        FacilityFloorResponse,
    )
    from app.services.sla_engine import get_sla_compliance_summary
    from app.services.telemetry_poller import telemetry_worker
    from app.services.billing_engine import generate_all_monthly_invoices, preview_tenant_invoice
except (ImportError, ValueError):
    from db.session import get_db
    from db.models import Tenant, SlaPolicy, Circuit, BodSession, Invoice, OutageIncident
    from db.schemas import (
        BusinessOverviewResponse,
        TenantResponse,
        TenantCreate,
        CircuitResponse,
        CircuitCreate,
        SlaPolicyResponse,
        BodRequestResponse,
        BodRequestCreate,
        BodRequestUpdateStage,
        InvoiceResponse,
        InvoiceCreate,
        InvoiceStatusUpdate,
        SlaComplianceRecordResponse,
        OutageIncidentResponse,
        OutageIncidentCreate,
        SimulateIncidentRequest,
        TelemetryStatusResponse,
        FacilityFloorResponse,
    )
    from services.sla_engine import get_sla_compliance_summary
    from services.telemetry_poller import telemetry_worker
    from services.billing_engine import generate_all_monthly_invoices, preview_tenant_invoice



router = APIRouter()


# ---------------- Business Overview ----------------

@router.get("/overview", response_model=BusinessOverviewResponse)
def get_business_overview(db: Session = Depends(get_db)):
    """Mengembalikan metrik ringkasan eksekutif bisnis."""
    total_tenants = db.query(Tenant).count()
    active_tenants = db.query(Tenant).filter(Tenant.status == "Active").count()
    total_circuits = db.query(Circuit).count()
    active_circuits = db.query(Circuit).filter(Circuit.operational_status == "Connected").count()

    total_invoiced = db.query(func.coalesce(func.sum(Invoice.total_due), 0.0)).scalar()
    total_paid = db.query(func.coalesce(func.sum(Invoice.total_due), 0.0)).filter(Invoice.status == "Paid").scalar()
    pending_bod = db.query(BodSession).filter(BodSession.stage < 3).count()

    return BusinessOverviewResponse(
        total_tenants=total_tenants,
        active_tenants=active_tenants,
        total_circuits=total_circuits,
        active_circuits=active_circuits,
        total_invoiced_amount=float(total_invoiced),
        total_paid_amount=float(total_paid),
        pending_bod_requests=pending_bod,
    )


# ---------------- Tenants (CRM) ----------------

@router.get("/tenants", response_model=List[TenantResponse])
def get_tenants(
    status: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Tenant)
    if status:
        query = query.filter(Tenant.status == status)
    if tier:
        query = query.filter(Tenant.contract_tier == tier)

    results = []
    for t in query.all():
        active_count = db.query(Circuit).filter(Circuit.tenant_id == t.id, Circuit.operational_status == "Connected").count()
        results.append(
            TenantResponse(
                id=t.id,
                name=t.name,
                asn=t.asn,
                customer_type=t.customer_type,
                contact_email=t.contact_email,
                rack_location=t.rack_location,
                contract_tier=t.contract_tier,
                monthly_base_commit=t.monthly_base_commit,
                status=t.status,
                created_at=t.created_at,
                active_circuits_count=active_count,
            )
        )
    return results


@router.post("/tenants", response_model=TenantResponse, status_code=201)
def create_tenant(body: TenantCreate, db: Session = Depends(get_db)):
    tenant_id = body.id or f"TNT-{uuid.uuid4().hex[:6].upper()}"
    existing = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Tenant ID {tenant_id} sudah terdaftar")

    new_tenant = Tenant(
        id=tenant_id,
        name=body.name,
        asn=body.asn,
        customer_type=body.customer_type,
        contact_email=body.contact_email,
        rack_location=body.rack_location,
        contract_tier=body.contract_tier,
        monthly_base_commit=body.monthly_base_commit,
        status=body.status,
    )
    db.add(new_tenant)
    db.commit()
    db.refresh(new_tenant)

    return TenantResponse(
        id=new_tenant.id,
        name=new_tenant.name,
        asn=new_tenant.asn,
        customer_type=new_tenant.customer_type,
        contact_email=new_tenant.contact_email,
        rack_location=new_tenant.rack_location,
        contract_tier=new_tenant.contract_tier,
        monthly_base_commit=new_tenant.monthly_base_commit,
        status=new_tenant.status,
        created_at=new_tenant.created_at,
        active_circuits_count=0,
    )


@router.get("/tenants/{tenant_id}", response_model=TenantResponse)
def get_tenant_detail(tenant_id: str, db: Session = Depends(get_db)):
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant tidak ditemukan")
    active_count = db.query(Circuit).filter(Circuit.tenant_id == t.id, Circuit.operational_status == "Connected").count()
    return TenantResponse(
        id=t.id,
        name=t.name,
        asn=t.asn,
        customer_type=t.customer_type,
        contact_email=t.contact_email,
        rack_location=t.rack_location,
        contract_tier=t.contract_tier,
        monthly_base_commit=t.monthly_base_commit,
        status=t.status,
        created_at=t.created_at,
        active_circuits_count=active_count,
    )


# ---------------- SLA Policies ----------------

@router.get("/sla/policies", response_model=List[SlaPolicyResponse])
def get_sla_policies(db: Session = Depends(get_db)):
    return db.query(SlaPolicy).all()


# ---------------- Circuits ----------------

@router.get("/circuits", response_model=List[CircuitResponse])
def get_circuits(
    tenant_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Circuit)
    if tenant_id:
        query = query.filter(Circuit.tenant_id == tenant_id)
    if status:
        query = query.filter(Circuit.operational_status == status)
    return query.all()


@router.post("/circuits", response_model=CircuitResponse, status_code=201)
def create_circuit(body: CircuitCreate, db: Session = Depends(get_db)):
    circuit_id = body.id or f"CKT-{uuid.uuid4().hex[:6].upper()}"
    new_circuit = Circuit(
        id=circuit_id,
        tenant_id=body.tenant_id,
        sla_policy_id=body.sla_policy_id,
        source_panel=body.source_panel,
        source_port=body.source_port,
        target_panel=body.target_panel,
        target_port=body.target_port,
        capacity=body.capacity,
        operational_status=body.operational_status,
    )
    db.add(new_circuit)
    db.commit()
    db.refresh(new_circuit)
    return new_circuit


# ---------------- Bandwidth on Demand (BoD) ----------------

@router.get("/bod/requests", response_model=List[BodRequestResponse])
def get_bod_requests(db: Session = Depends(get_db)):
    requests = db.query(BodSession).order_by(BodSession.created_at.desc()).all()
    results = []
    for r in requests:
        t = db.query(Tenant).filter(Tenant.id == r.tenant_id).first()
        results.append(
            BodRequestResponse(
                id=r.id,
                tenant_id=r.tenant_id,
                tenant_name=t.name if t else "Unknown",
                circuit_id=r.circuit_id,
                route=r.route,
                source_panel=r.source_panel,
                source_port=r.source_port,
                target_panel=r.target_panel,
                target_port=r.target_port,
                capacity=r.capacity,
                sla_tier=r.sla_tier,
                duration=r.duration,
                stage=r.stage,
                insertion_loss_db=r.insertion_loss_db,
                return_loss_db=r.return_loss_db,
                est_switching_time_sec=r.est_switching_time_sec,
                monthly_cost=r.monthly_cost,
                auto_approved=r.auto_approved,
                created_at=r.created_at,
            )
        )
    return results


@router.post("/bod/requests", response_model=BodRequestResponse, status_code=201)
def create_bod_request(body: BodRequestCreate, db: Session = Depends(get_db)):
    bod_id = body.id or f"BOD-{uuid.uuid4().hex[:5].upper()}"
    tenant = db.query(Tenant).filter(Tenant.id == body.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant {body.tenant_id} tidak ditemukan")

    # Hitung estimasi biaya bulanan dasar jika tidak disediakan
    capacity_multipliers = {"10G": 300.0, "100G": 1200.0, "400G": 2400.0}
    calc_cost = body.monthly_cost if (body.monthly_cost and body.monthly_cost > 0) else capacity_multipliers.get(body.capacity, 1200.0)

    new_bod = BodSession(
        id=bod_id,
        tenant_id=body.tenant_id,
        circuit_id=None,
        route=body.route,
        source_panel=body.source_panel,
        source_port=body.source_port,
        target_panel=body.target_panel,
        target_port=body.target_port,
        capacity=body.capacity,
        sla_tier=body.sla_tier,
        duration=body.duration,
        stage=0,  # Validating
        insertion_loss_db=body.insertion_loss_db or 0.45,
        return_loss_db=body.return_loss_db or -65.0,
        est_switching_time_sec=body.est_switching_time_sec or 45,
        monthly_cost=calc_cost,
        auto_approved=True,
    )
    db.add(new_bod)
    db.commit()
    db.refresh(new_bod)

    return BodRequestResponse(
        id=new_bod.id,
        tenant_id=new_bod.tenant_id,
        tenant_name=tenant.name,
        circuit_id=new_bod.circuit_id,
        route=new_bod.route,
        source_panel=new_bod.source_panel,
        source_port=new_bod.source_port,
        target_panel=new_bod.target_panel,
        target_port=new_bod.target_port,
        capacity=new_bod.capacity,
        sla_tier=new_bod.sla_tier,
        duration=new_bod.duration,
        stage=new_bod.stage,
        insertion_loss_db=new_bod.insertion_loss_db,
        return_loss_db=new_bod.return_loss_db,
        est_switching_time_sec=new_bod.est_switching_time_sec,
        monthly_cost=new_bod.monthly_cost,
        auto_approved=new_bod.auto_approved,
        created_at=new_bod.created_at,
    )


@router.patch("/bod/requests/{request_id}/stage", response_model=BodRequestResponse)
def update_bod_stage(request_id: str, body: BodRequestUpdateStage, db: Session = Depends(get_db)):
    bod = db.query(BodSession).filter(BodSession.id == request_id).first()
    if not bod:
        raise HTTPException(status_code=404, detail="Permintaan BoD tidak ditemukan")
    bod.stage = body.stage
    db.commit()
    db.refresh(bod)

    t = db.query(Tenant).filter(Tenant.id == bod.tenant_id).first()
    return BodRequestResponse(
        id=bod.id,
        tenant_id=bod.tenant_id,
        tenant_name=t.name if t else "Unknown",
        circuit_id=bod.circuit_id,
        route=bod.route,
        source_panel=bod.source_panel,
        source_port=bod.source_port,
        target_panel=bod.target_panel,
        target_port=bod.target_port,
        capacity=bod.capacity,
        sla_tier=bod.sla_tier,
        duration=bod.duration,
        stage=bod.stage,
        insertion_loss_db=bod.insertion_loss_db,
        return_loss_db=bod.return_loss_db,
        est_switching_time_sec=bod.est_switching_time_sec,
        monthly_cost=bod.monthly_cost,
        auto_approved=bod.auto_approved,
        created_at=bod.created_at,
    )


# ---------------- Invoices (Billing Engine) ----------------

@router.get("/invoices", response_model=List[InvoiceResponse])
def get_invoices(tenant_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    query = db.query(Invoice).order_by(Invoice.created_at.desc())
    if tenant_id:
        query = query.filter(Invoice.tenant_id == tenant_id)

    results = []
    for inv in query.all():
        t = db.query(Tenant).filter(Tenant.id == inv.tenant_id).first()
        results.append(
            InvoiceResponse(
                id=inv.id,
                tenant_id=inv.tenant_id,
                tenant_name=t.name if t else "Unknown",
                asn=t.asn if t else 0,
                billing_period=inv.billing_period,
                base_port_fee=inv.base_port_fee,
                bod_burst_usage_hours=inv.bod_burst_usage_hours,
                bod_burst_rate_per_hour=inv.bod_burst_rate_per_hour,
                bod_burst_total=inv.bod_burst_total,
                sla_outage_downtime_min=inv.sla_outage_downtime_min,
                sla_penalty_credit=inv.sla_penalty_credit,
                subtotal=inv.subtotal,
                tax_amount=inv.tax_amount,
                total_due=inv.total_due,
                status=inv.status,
                due_date=inv.due_date,
                created_at=inv.created_at,
            )
        )
    return results


@router.post("/invoices", response_model=InvoiceResponse, status_code=201)
def create_invoice(body: InvoiceCreate, db: Session = Depends(get_db)):
    inv_id = body.id or f"INV-2026-{uuid.uuid4().hex[:4].upper()}"
    tenant = db.query(Tenant).filter(Tenant.id == body.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant tidak ditemukan")

    # Formula Kalkulasi Tagihan
    burst_total = body.bod_burst_total or (body.bod_burst_usage_hours * body.bod_burst_rate_per_hour)
    subtotal = max(0.0, body.base_port_fee + burst_total - body.sla_penalty_credit)
    tax = round(subtotal * 0.11, 2)  # PPN 11%
    total_due = round(subtotal + tax, 2)
    due_date = body.due_date or "2026-11-15"

    new_inv = Invoice(
        id=inv_id,
        tenant_id=body.tenant_id,
        billing_period=body.billing_period,
        base_port_fee=body.base_port_fee,
        bod_burst_usage_hours=body.bod_burst_usage_hours,
        bod_burst_rate_per_hour=body.bod_burst_rate_per_hour,
        bod_burst_total=burst_total,
        sla_outage_downtime_min=body.sla_outage_downtime_min,
        sla_penalty_credit=body.sla_penalty_credit,
        subtotal=subtotal,
        tax_amount=tax,
        total_due=total_due,
        status=body.status,
        due_date=due_date,
    )
    db.add(new_inv)
    db.commit()
    db.refresh(new_inv)

    return InvoiceResponse(
        id=new_inv.id,
        tenant_id=new_inv.tenant_id,
        tenant_name=tenant.name,
        asn=tenant.asn,
        billing_period=new_inv.billing_period,
        base_port_fee=new_inv.base_port_fee,
        bod_burst_usage_hours=new_inv.bod_burst_usage_hours,
        bod_burst_rate_per_hour=new_inv.bod_burst_rate_per_hour,
        bod_burst_total=new_inv.bod_burst_total,
        sla_outage_downtime_min=new_inv.sla_outage_downtime_min,
        sla_penalty_credit=new_inv.sla_penalty_credit,
        subtotal=new_inv.subtotal,
        tax_amount=new_inv.tax_amount,
        total_due=new_inv.total_due,
        status=new_inv.status,
        due_date=new_inv.due_date,
        created_at=new_inv.created_at,
    )


@router.patch("/invoices/{invoice_id}/status", response_model=InvoiceResponse)
def update_invoice_status(invoice_id: str, body: InvoiceStatusUpdate, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice tidak ditemukan")
    inv.status = body.status
    db.commit()
    db.refresh(inv)

    tenant = db.query(Tenant).filter(Tenant.id == inv.tenant_id).first()
    return InvoiceResponse(
        id=inv.id,
        tenant_id=inv.tenant_id,
        tenant_name=tenant.name if tenant else "Unknown",
        asn=tenant.asn if tenant else 0,
        billing_period=inv.billing_period,
        base_port_fee=inv.base_port_fee,
        bod_burst_usage_hours=inv.bod_burst_usage_hours,
        bod_burst_rate_per_hour=inv.bod_burst_rate_per_hour,
        bod_burst_total=inv.bod_burst_total,
        sla_outage_downtime_min=inv.sla_outage_downtime_min,
        sla_penalty_credit=inv.sla_penalty_credit,
        subtotal=inv.subtotal,
        tax_amount=inv.tax_amount,
        total_due=inv.total_due,
        status=inv.status,
        due_date=inv.due_date,
        created_at=inv.created_at,
    )


@router.post("/billing/generate-all", response_model=List[InvoiceResponse])
def batch_generate_invoices(
    billing_period: str = Query(default="October 2026"),
    db: Session = Depends(get_db),
):
    """
    Menjalankan automated rating engine untuk semua tenant aktif pada periode tagihan tertentu.
    """
    invoices = generate_all_monthly_invoices(billing_period, db)
    results = []
    for inv in invoices:
        t = db.query(Tenant).filter(Tenant.id == inv.tenant_id).first()
        results.append(
            InvoiceResponse(
                id=inv.id,
                tenant_id=inv.tenant_id,
                tenant_name=t.name if t else "Unknown",
                asn=t.asn if t else 0,
                billing_period=inv.billing_period,
                base_port_fee=inv.base_port_fee,
                bod_burst_usage_hours=inv.bod_burst_usage_hours,
                bod_burst_rate_per_hour=inv.bod_burst_rate_per_hour,
                bod_burst_total=inv.bod_burst_total,
                sla_outage_downtime_min=inv.sla_outage_downtime_min,
                sla_penalty_credit=inv.sla_penalty_credit,
                subtotal=inv.subtotal,
                tax_amount=inv.tax_amount,
                total_due=inv.total_due,
                status=inv.status,
                due_date=inv.due_date,
                created_at=inv.created_at,
            )
        )
    return results


@router.get("/billing/preview/{tenant_id}")
@router.post("/billing/preview/{tenant_id}")
def preview_invoice(
    tenant_id: str,
    billing_period: str = Query(default="October 2026"),
    db: Session = Depends(get_db),
):
    """
    Melakukan dry-run kalkulasi rating invoice untuk tenant tertentu tanpa menyimpan ke database.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant tidak ditemukan")
    try:
        preview = preview_tenant_invoice(tenant_id, billing_period, db)
        preview["tenant_name"] = tenant.name
        preview["asn"] = tenant.asn
        return preview
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------- SLA Compliance & Outage Incident Tracking ----------------

@router.get("/sla/compliance", response_model=List[SlaComplianceRecordResponse])
def get_sla_compliance(db: Session = Depends(get_db)):
    """Mengembalikan kalkulasi kepatuhan SLA rolling 30-hari aktual per segmen pelanggan."""
    summary = get_sla_compliance_summary(db)
    return [SlaComplianceRecordResponse(**item) for item in summary]


@router.get("/sla/incidents", response_model=List[OutageIncidentResponse])
def get_outage_incidents(
    circuit_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),  # 'active' or 'resolved'
    db: Session = Depends(get_db),
):
    """Mengambil daftar riwayat tiket insiden / outage optik."""
    query = db.query(OutageIncident).order_by(OutageIncident.started_at.desc())
    if circuit_id:
        query = query.filter(OutageIncident.circuit_id == circuit_id)
    if status == "active":
        query = query.filter(OutageIncident.resolved_at.is_(None))
    elif status == "resolved":
        query = query.filter(OutageIncident.resolved_at.isnot(None))

    results = []
    for inc in query.all():
        ckt = db.query(Circuit).filter(Circuit.id == inc.circuit_id).first()
        t_name = "Unknown"
        if ckt:
            t = db.query(Tenant).filter(Tenant.id == ckt.tenant_id).first()
            if t:
                t_name = t.name
        results.append(
            OutageIncidentResponse(
                id=inc.id,
                circuit_id=inc.circuit_id,
                tenant_name=t_name,
                severity=inc.severity,
                started_at=inc.started_at,
                resolved_at=inc.resolved_at,
                duration_seconds=inc.duration_seconds,
                root_cause=inc.root_cause,
            )
        )
    return results


@router.post("/sla/incidents", response_model=OutageIncidentResponse, status_code=201)
def create_outage_incident(body: OutageIncidentCreate, db: Session = Depends(get_db)):
    """Mencatat tiket gangguan jaringan baru secara manual."""
    ckt = db.query(Circuit).filter(Circuit.id == body.circuit_id).first()
    if not ckt:
        raise HTTPException(status_code=404, detail=f"Sirkuit {body.circuit_id} tidak ditemukan")

    inc_id = f"INC-{datetime.now().strftime('%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
    new_inc = OutageIncident(
        id=inc_id,
        circuit_id=body.circuit_id,
        severity=body.severity,
        started_at=datetime.now(),
        resolved_at=None,
        duration_seconds=0,
        root_cause=body.root_cause,
    )
    # Update status sirkuit ke Degraded
    ckt.operational_status = "Degraded"
    db.add(new_inc)
    db.commit()
    db.refresh(new_inc)

    t = db.query(Tenant).filter(Tenant.id == ckt.tenant_id).first()
    return OutageIncidentResponse(
        id=new_inc.id,
        circuit_id=new_inc.circuit_id,
        tenant_name=t.name if t else "Unknown",
        severity=new_inc.severity,
        started_at=new_inc.started_at,
        resolved_at=new_inc.resolved_at,
        duration_seconds=new_inc.duration_seconds,
        root_cause=new_inc.root_cause,
    )


@router.post("/sla/incidents/simulate", response_model=OutageIncidentResponse, status_code=201)
def simulate_outage_incident(body: SimulateIncidentRequest, db: Session = Depends(get_db)):
    """
    Simulator Gangguan & Uji Kepatuhan SLA:
    Menghasilkan catatan insiden dengan durasi downtime tertentu (dalam menit) untuk menguji kalkulasi otomatis degradasi SLA dan kredit penalti.
    """
    ckt = db.query(Circuit).filter(Circuit.id == body.circuit_id).first()
    if not ckt:
        # Fallback ambil sirkuit pertama jika ID tidak spesifik
        ckt = db.query(Circuit).first()
        if not ckt:
            raise HTTPException(status_code=400, detail="Tidak ada sirkuit terdaftar untuk simulasi")

    duration_sec = body.downtime_minutes * 60
    inc_id = f"SIM-{datetime.now().strftime('%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
    new_inc = OutageIncident(
        id=inc_id,
        circuit_id=ckt.id,
        severity=body.severity,
        started_at=datetime.now(),
        resolved_at=datetime.now(),
        duration_seconds=duration_sec,
        root_cause=f"[Simulated Drill] {body.root_cause} ({body.downtime_minutes} min outage)",
    )
    db.add(new_inc)
    db.commit()
    db.refresh(new_inc)

    t = db.query(Tenant).filter(Tenant.id == ckt.tenant_id).first()
    return OutageIncidentResponse(
        id=new_inc.id,
        circuit_id=new_inc.circuit_id,
        tenant_name=t.name if t else "Unknown",
        severity=new_inc.severity,
        started_at=new_inc.started_at,
        resolved_at=new_inc.resolved_at,
        duration_seconds=new_inc.duration_seconds,
        root_cause=new_inc.root_cause,
    )


@router.patch("/sla/incidents/{incident_id}/resolve", response_model=OutageIncidentResponse)
def resolve_outage_incident(incident_id: str, db: Session = Depends(get_db)):
    """Menyelesaikan status insiden gangguan dan mengunci total durasi downtime."""
    inc = db.query(OutageIncident).filter(OutageIncident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Insiden tidak ditemukan")

    if not inc.resolved_at:
        now = datetime.now()
        inc.resolved_at = now
        delta = (now - inc.started_at).total_seconds()
        inc.duration_seconds = max(60, int(delta))

    # Kembalikan status sirkuit ke Connected
    ckt = db.query(Circuit).filter(Circuit.id == inc.circuit_id).first()
    if ckt:
        ckt.operational_status = "Connected"

    db.commit()
    db.refresh(inc)

    t_name = "Unknown"
    if ckt:
        t = db.query(Tenant).filter(Tenant.id == ckt.tenant_id).first()
        if t:
            t_name = t.name

    return OutageIncidentResponse(
        id=inc.id,
        circuit_id=inc.circuit_id,
        tenant_name=t_name,
        severity=inc.severity,
        started_at=inc.started_at,
        resolved_at=inc.resolved_at,
        duration_seconds=inc.duration_seconds,
        root_cause=inc.root_cause,
    )


# ---------------- Telemetry Poller Status ----------------

@router.get("/telemetry/status", response_model=TelemetryStatusResponse)
def get_telemetry_status():
    """Mengambil status kesehatan poller background telemetri."""
    status = telemetry_worker.get_status()
    return TelemetryStatusResponse(**status)


# ---------------- Facility Floors (Data Center Layout) ----------------

FACILITY_FLOORS_DATA = [
    {
        "id": "5th",
        "name": "5th Floor — Data Hall (Zone B)",
        "room": "Secondary Fabric MMR-B",
        "total_fibers": 276,
        "xsos_units": "2× XSOS-576D robotic subracks",
        "role": "Secondary IXP Meet-Me-Room & Member Distribution",
        "status": "Nominal",
        "description": "Distribusi koneksi member cross-connect ke rack Data Hall Zone B (276 serat optik per MMR).",
        "active_circuits_count": 8,
        "interconnect": "MMR-A ⇄ MMR-B (24 tie-fibers)",
        "racks": ["MMR-B / R20-01", "MMR-B / R21-04", "MMR-B / R22-10"],
    },
    {
        "id": "3rd-4th",
        "name": "3rd — 4th Floor — Space for Future Expansion",
        "room": "Unallocated Expansion Floor",
        "total_fibers": 0,
        "xsos_units": "Unpopulated (Reserved Bays)",
        "role": "Future Expansion Reserve",
        "status": "Standby",
        "description": "Kapasitas ekspansi masa depan untuk penambahan rack tenant & fabric robotic modular fase 2.",
        "active_circuits_count": 0,
        "interconnect": "Vertical Riser Pathway Reserved",
        "racks": ["Reserved R30-R45"],
    },
    {
        "id": "2nd",
        "name": "2nd Floor — Data Hall (Zone A)",
        "room": "Primary IXP Meet-Me-Room (MMR-A)",
        "total_fibers": 276,
        "xsos_units": "2× XSOS-576D robotic fabric",
        "role": "Primary Peering Fabric & Active Route Cross-Connects",
        "status": "Nominal",
        "description": "Peering cross-connects aktif untuk anggota IXP dan distribusi serat optik ke rack pelanggan (Zone A).",
        "active_circuits_count": 14,
        "interconnect": "MMR-A ⇄ MMR-B (24 fibers)",
        "racks": ["MMR-A / R03-02", "MMR-A / R08-12", "MMR-A / R11-05", "MMR-A / R15-08"],
    },
    {
        "id": "1st",
        "name": "1st Floor — Office A / Office B",
        "room": "Carrier Demarcation & Meet-Point",
        "total_fibers": 48,
        "xsos_units": "Optical Patch Panel Demarcation",
        "role": "Carrier Interconnect & Corporate Hand-off",
        "status": "Nominal",
        "description": "Jalur interkoneksi carrier transit & hand-off konektivitas operasional gedung.",
        "active_circuits_count": 2,
        "interconnect": "Riser feed to Ground Floor MDF",
        "racks": ["DEMARC-01", "DEMARC-02"],
    },
    {
        "id": "ground",
        "name": "Ground Floor — Telecom-A/B Rooms",
        "room": "MDF-1 / MDF-2 / MDF-3 (Main Distribution Frame)",
        "total_fibers": 288,
        "xsos_units": "3× XSOS-576D robotic subracks",
        "role": "Inbound Fiber Feeds (3× 96-core) & Backbone Riser",
        "status": "Nominal",
        "description": "Titik masuk kabel fiber optik utama bawah tanah (sub-duct) dan terminasi riser backbone ke seluruh MMR.",
        "active_circuits_count": 18,
        "interconnect": "MDF1—MDF3 interconnect: 192 fibers · 288 inbound fibers",
        "racks": ["MDF-1 Riser", "MDF-2 Riser", "MDF-3 Riser"],
    },
]


@router.get("/facility/floors", response_model=List[FacilityFloorResponse])
def get_facility_floors(db: Session = Depends(get_db)):
    """Mengambil daftar denah lantai fasilitas datacenter beserta spesifikasi perangkat & fiber."""
    # Hitung live circuits jika ada di database
    results = []
    for item in FACILITY_FLOORS_DATA:
        floor_copy = dict(item)
        if item["id"] == "2nd":
            count = db.query(Circuit).filter(Circuit.source_panel.like("%XSOS-576D-1%")).count()
            if count > 0:
                floor_copy["active_circuits_count"] = count
        results.append(FacilityFloorResponse(**floor_copy))
    return results


@router.get("/facility/floors/{floor_id}", response_model=FacilityFloorResponse)
def get_facility_floor_detail(floor_id: str, db: Session = Depends(get_db)):
    """Mengambil detail satu lantai fasilitas berdasarkan ID (5th, 3rd-4th, 2nd, 1st, ground)."""
    found = next((item for item in FACILITY_FLOORS_DATA if item["id"].lower() == floor_id.lower()), None)
    if not found:
        raise HTTPException(status_code=404, detail=f"Lantai '{floor_id}' tidak ditemukan")
    
    floor_copy = dict(found)
    if found["id"] == "2nd":
        count = db.query(Circuit).filter(Circuit.source_panel.like("%XSOS-576D-1%")).count()
        if count > 0:
            floor_copy["active_circuits_count"] = count

    return FacilityFloorResponse(**floor_copy)

