"""
Pydantic v2 schemas for business data validation & serialization.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


# ---------------- SLA Policy Schemas ----------------

class SlaPolicyBase(BaseModel):
    tier_name: str
    uptime_target_pct: float
    latency_target_ms: float
    penalty_rate_pct: float


class SlaPolicyResponse(SlaPolicyBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# ---------------- Circuit Schemas ----------------

class CircuitBase(BaseModel):
    tenant_id: str
    sla_policy_id: str
    source_panel: str
    source_port: int
    target_panel: str
    target_port: int
    capacity: str = "100G"
    operational_status: str = "Connected"


class CircuitCreate(CircuitBase):
    id: Optional[str] = None


class CircuitResponse(CircuitBase):
    id: str
    activated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ---------------- Tenant Schemas ----------------

class TenantBase(BaseModel):
    name: str
    asn: int
    customer_type: str = "Enterprise"
    contact_email: str
    rack_location: str
    contract_tier: str = "Silver"
    monthly_base_commit: float = 0.0
    status: str = "Active"


class TenantCreate(TenantBase):
    id: Optional[str] = None


class TenantResponse(TenantBase):
    id: str
    created_at: datetime
    active_circuits_count: int = 0
    model_config = ConfigDict(from_attributes=True)


# ---------------- BoD Session / Request Schemas ----------------

class BodRequestBase(BaseModel):
    tenant_id: str
    circuit_id: Optional[str] = None
    route: str
    source_panel: str
    source_port: int
    target_panel: str
    target_port: int
    capacity: str = "100G"
    sla_tier: str = "Gold"
    duration: str = "Recurring"
    stage: int = 0
    insertion_loss_db: float = 0.45
    return_loss_db: float = -65.0
    est_switching_time_sec: int = 45
    monthly_cost: float = 0.0
    auto_approved: bool = True


class BodRequestCreate(BaseModel):
    id: Optional[str] = None
    tenant_id: str
    route: str
    source_panel: str
    source_port: int
    target_panel: str
    target_port: int
    capacity: str = "100G"
    sla_tier: str = "Gold"
    duration: str = "Recurring"
    insertion_loss_db: Optional[float] = 0.45
    return_loss_db: Optional[float] = -65.0
    est_switching_time_sec: Optional[int] = 45
    monthly_cost: Optional[float] = 0.0


class BodRequestUpdateStage(BaseModel):
    stage: int = Field(ge=0, le=3)


class BodRequestResponse(BodRequestBase):
    id: str
    tenant_name: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ---------------- Invoice Schemas ----------------

class InvoiceBase(BaseModel):
    tenant_id: str
    billing_period: str
    base_port_fee: float
    bod_burst_usage_hours: float = 0.0
    bod_burst_rate_per_hour: float = 25.0
    bod_burst_total: float = 0.0
    sla_outage_downtime_min: int = 0
    sla_penalty_credit: float = 0.0
    subtotal: float
    tax_amount: float
    total_due: float
    status: str = "Issued"
    due_date: str


class InvoiceCreate(BaseModel):
    id: Optional[str] = None
    tenant_id: str
    billing_period: str = "October 2026"
    base_port_fee: float
    bod_burst_usage_hours: float = 0.0
    bod_burst_rate_per_hour: float = 25.0
    bod_burst_total: float = 0.0
    sla_outage_downtime_min: int = 0
    sla_penalty_credit: float = 0.0
    status: str = "Issued"
    due_date: Optional[str] = None


class InvoiceStatusUpdate(BaseModel):
    status: str  # Draft, Issued, Paid


class InvoiceResponse(InvoiceBase):
    id: str
    tenant_name: Optional[str] = None
    asn: Optional[int] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ---------------- Business Overview ----------------

class BusinessOverviewResponse(BaseModel):
    total_tenants: int
    active_tenants: int
    total_circuits: int
    active_circuits: int
    total_invoiced_amount: float
    total_paid_amount: float
    pending_bod_requests: int
    model_config = ConfigDict(from_attributes=True)


# ---------------- SLA Compliance & Incidents ----------------

class SlaComplianceRecordResponse(BaseModel):
    customer_type: str
    sla_tier: str
    uptime_target_pct: float
    actual_uptime_pct: float
    latency_target_ms: float
    actual_latency_ms: float
    status: str
    total_downtime_min: float = 0.0
    penalty_credit: float = 0.0
    model_config = ConfigDict(from_attributes=True)


class OutageIncidentBase(BaseModel):
    circuit_id: str
    severity: str = "Critical"
    root_cause: str = "Optical LOS"


class OutageIncidentCreate(OutageIncidentBase):
    pass


class SimulateIncidentRequest(BaseModel):
    circuit_id: str
    downtime_minutes: int = 15
    severity: str = "Critical"
    root_cause: str = "Simulated Fiber Cut / Optical LOS"


class OutageIncidentResponse(OutageIncidentBase):
    id: str
    tenant_name: Optional[str] = None
    started_at: datetime
    resolved_at: Optional[datetime] = None
    duration_seconds: int = 0
    model_config = ConfigDict(from_attributes=True)


# ---------------- Telemetry Poller Status ----------------

class TelemetryStatusResponse(BaseModel):
    is_running: bool
    interval_seconds: float
    poll_count: int
    last_poll_time: Optional[str] = None
    last_error: Optional[str] = None
    has_data: bool
    model_config = ConfigDict(from_attributes=True)


# ---------------- Facility Floor Schemas ----------------

class FacilityFloorResponse(BaseModel):
    id: str
    name: str
    room: str
    total_fibers: int
    xsos_units: str
    role: str
    status: str
    description: str
    active_circuits_count: int = 0
    interconnect: Optional[str] = None
    racks: List[str] = []
    model_config = ConfigDict(from_attributes=True)

