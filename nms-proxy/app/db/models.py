"""
SQLAlchemy ORM Models for Xenoptics IXP Orchestration & BSS/OSS.
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .session import Base


def utcnow():
    return datetime.now(timezone.utc)


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(String(32), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    asn = Column(Integer, nullable=False)
    customer_type = Column(String(32), nullable=False, default="Enterprise")  # Hyperscaler, CDN, FSI, Enterprise
    contact_email = Column(String(128), nullable=False)
    rack_location = Column(String(64), nullable=False)
    contract_tier = Column(String(32), nullable=False, default="Silver")  # Platinum, Gold, Silver, Bronze
    monthly_base_commit = Column(Float, nullable=False, default=0.0)
    status = Column(String(32), nullable=False, default="Active")  # Active, Suspended, Pending
    created_at = Column(DateTime, default=utcnow, nullable=False)

    # Relasi
    circuits = relationship("Circuit", back_populates="tenant", cascade="all, delete-orphan")
    bod_sessions = relationship("BodSession", back_populates="tenant")
    invoices = relationship("Invoice", back_populates="tenant")


class SlaPolicy(Base):
    __tablename__ = "sla_policies"

    id = Column(String(32), primary_key=True, index=True)
    tier_name = Column(String(32), nullable=False, unique=True)  # Platinum, Gold, Silver
    uptime_target_pct = Column(Float, nullable=False)  # 99.999, 99.99, 99.95
    latency_target_ms = Column(Float, nullable=False)   # 1.0, 2.0, 5.0
    penalty_rate_pct = Column(Float, nullable=False)    # 10.0%

    circuits = relationship("Circuit", back_populates="sla_policy")


class Circuit(Base):
    __tablename__ = "circuits"

    id = Column(String(32), primary_key=True, index=True)
    tenant_id = Column(String(32), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    sla_policy_id = Column(String(32), ForeignKey("sla_policies.id"), nullable=False)
    source_panel = Column(String(64), nullable=False)
    source_port = Column(Integer, nullable=False)
    target_panel = Column(String(64), nullable=False)
    target_port = Column(Integer, nullable=False)
    capacity = Column(String(16), nullable=False, default="100G")  # 10G, 100G, 400G
    operational_status = Column(String(32), nullable=False, default="Connected")  # Connected, Standby, Degraded, Disconnected
    activated_at = Column(DateTime, default=utcnow, nullable=False)

    tenant = relationship("Tenant", back_populates="circuits")
    sla_policy = relationship("SlaPolicy", back_populates="circuits")
    bod_sessions = relationship("BodSession", back_populates="circuit")
    outage_incidents = relationship("OutageIncident", back_populates="circuit")


class BodSession(Base):
    __tablename__ = "bod_sessions"

    id = Column(String(32), primary_key=True, index=True)
    tenant_id = Column(String(32), ForeignKey("tenants.id"), nullable=False, index=True)
    circuit_id = Column(String(32), ForeignKey("circuits.id"), nullable=True)
    route = Column(String(128), nullable=False)
    source_panel = Column(String(64), nullable=False)
    source_port = Column(Integer, nullable=False)
    target_panel = Column(String(64), nullable=False)
    target_port = Column(Integer, nullable=False)
    capacity = Column(String(16), nullable=False)  # 10G, 100G, 400G
    sla_tier = Column(String(32), nullable=False)  # Platinum, Gold, Silver
    duration = Column(String(64), nullable=False)  # Recurring, Temporary Burst (24h)
    stage = Column(Integer, nullable=False, default=0)  # 0: Validating, 1: Configuring, 2: Activating, 3: Active
    insertion_loss_db = Column(Float, nullable=False, default=0.45)
    return_loss_db = Column(Float, nullable=False, default=-65.0)
    est_switching_time_sec = Column(Integer, nullable=False, default=45)
    monthly_cost = Column(Float, nullable=False, default=0.0)
    auto_approved = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    tenant = relationship("Tenant", back_populates="bod_sessions")
    circuit = relationship("Circuit", back_populates="bod_sessions")


class OutageIncident(Base):
    __tablename__ = "outage_incidents"

    id = Column(String(32), primary_key=True, index=True)
    circuit_id = Column(String(32), ForeignKey("circuits.id", ondelete="CASCADE"), nullable=False, index=True)
    severity = Column(String(32), nullable=False, default="Critical")  # Critical, Warning, Info
    started_at = Column(DateTime, default=utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=False, default=0)
    root_cause = Column(Text, nullable=False, default="Optical LOS")

    circuit = relationship("Circuit", back_populates="outage_incidents")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String(32), primary_key=True, index=True)
    tenant_id = Column(String(32), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    billing_period = Column(String(64), nullable=False)
    base_port_fee = Column(Float, nullable=False, default=0.0)
    bod_burst_usage_hours = Column(Float, nullable=False, default=0.0)
    bod_burst_rate_per_hour = Column(Float, nullable=False, default=25.0)
    bod_burst_total = Column(Float, nullable=False, default=0.0)
    sla_outage_downtime_min = Column(Integer, nullable=False, default=0)
    sla_penalty_credit = Column(Float, nullable=False, default=0.0)
    subtotal = Column(Float, nullable=False, default=0.0)
    tax_amount = Column(Float, nullable=False, default=0.0)
    total_due = Column(Float, nullable=False, default=0.0)
    status = Column(String(32), nullable=False, default="Issued")  # Draft, Issued, Paid
    due_date = Column(String(32), nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    tenant = relationship("Tenant", back_populates="invoices")
