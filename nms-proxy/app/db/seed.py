"""
Database seeder module for initial baseline configuration.
Mengisi database dengan data tenant, SLA, sirkuit, dan invoice inisial jika kosong.
"""
import logging
from sqlalchemy.orm import Session
from .session import Base, SessionLocal, engine
from .models import Tenant, SlaPolicy, Circuit, BodSession, Invoice

logger = logging.getLogger(__name__)


def init_db_and_seed() -> None:
    """Inisialisasi tabel dan seed data jika belum ada."""
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        # Cek apakah data sudah ada
        if db.query(Tenant).count() > 0:
            logger.info("Database sudah memiliki data awal, lewati seeder.")
            return

        logger.info("Melakukan seeding data awal ke basis data...")

        # 1. SLA Policies
        sla_policies = [
            SlaPolicy(id="SLA-PLATINUM", tier_name="Platinum", uptime_target_pct=99.999, latency_target_ms=1.0, penalty_rate_pct=15.0),
            SlaPolicy(id="SLA-GOLD", tier_name="Gold", uptime_target_pct=99.99, latency_target_ms=2.0, penalty_rate_pct=10.0),
            SlaPolicy(id="SLA-SILVER", tier_name="Silver", uptime_target_pct=99.95, latency_target_ms=5.0, penalty_rate_pct=5.0),
        ]
        db.add_all(sla_policies)
        db.flush()

        # 2. Tenants
        tenants = [
            Tenant(
                id="TNT-001",
                name="Google Global Cache & Peering",
                asn=15169,
                customer_type="Hyperscaler",
                contact_email="peering-noc@google.com",
                rack_location="MMR-A / R08-12",
                contract_tier="Gold",
                monthly_base_commit=14400.0,
                status="Active",
            ),
            Tenant(
                id="TNT-002",
                name="Cloudflare Edge Network",
                asn=13335,
                customer_type="CDN",
                contact_email="ops@cloudflare.com",
                rack_location="MMR-B / R21-04",
                contract_tier="Gold",
                monthly_base_commit=9600.0,
                status="Active",
            ),
            Tenant(
                id="TNT-003",
                name="PT Bank Mandiri (FSI Primary)",
                asn=4761,
                customer_type="FSI",
                contact_email="netops.sec@bankmandiri.co.id",
                rack_location="MMR-A / R03-02",
                contract_tier="Platinum",
                monthly_base_commit=8800.0,
                status="Active",
            ),
            Tenant(
                id="TNT-004",
                name="Microsoft Azure Peering",
                asn=8075,
                customer_type="Hyperscaler",
                contact_email="ms-peering@microsoft.com",
                rack_location="MMR-B / R14-08",
                contract_tier="Gold",
                monthly_base_commit=19200.0,
                status="Active",
            ),
            Tenant(
                id="TNT-005",
                name="Akamai Technologies Edge",
                asn=20940,
                customer_type="CDN",
                contact_email="akamai-noc@akamai.com",
                rack_location="MMR-A / R11-06",
                contract_tier="Gold",
                monthly_base_commit=7200.0,
                status="Active",
            ),
            Tenant(
                id="TNT-006",
                name="Telkom Indonesia Transit",
                asn=7713,
                customer_type="Enterprise",
                contact_email="noc@telkom.co.id",
                rack_location="MMR-B / R22-10",
                contract_tier="Silver",
                monthly_base_commit=6500.0,
                status="Active",
            ),
        ]
        db.add_all(tenants)
        db.flush()

        # 3. Baseline Active Circuits
        circuits = [
            Circuit(
                id="CKT-1001",
                tenant_id="TNT-001",
                sla_policy_id="SLA-GOLD",
                source_panel="XSOS-576D-1",
                source_port=24,
                target_panel="XSOS-576D-2",
                target_port=120,
                capacity="100G",
                operational_status="Connected",
            ),
            Circuit(
                id="CKT-1002",
                tenant_id="TNT-002",
                sla_policy_id="SLA-GOLD",
                source_panel="XSOS-576D-2",
                source_port=48,
                target_panel="XSOS-576D-3",
                target_port=210,
                capacity="400G",
                operational_status="Connected",
            ),
            Circuit(
                id="CKT-1003",
                tenant_id="TNT-003",
                sla_policy_id="SLA-PLATINUM",
                source_panel="XSOS-576D-1",
                source_port=12,
                target_panel="XSOS-576D-4",
                target_port=88,
                capacity="100G",
                operational_status="Connected",
            ),
        ]
        db.add_all(circuits)
        db.flush()

        # 4. BoD Sessions
        bod_sessions = [
            BodSession(
                id="BOD-40217",
                tenant_id="TNT-001",
                circuit_id="CKT-1001",
                route="MMR-A/R08 ──▶ Fabric-01",
                source_panel="XSOS-576D-1",
                source_port=24,
                target_panel="XSOS-576D-2",
                target_port=120,
                capacity="100G",
                sla_tier="Gold",
                duration="Recurring",
                stage=3,
                insertion_loss_db=0.44,
                return_loss_db=-66.5,
                est_switching_time_sec=42,
                monthly_cost=1200.0,
                auto_approved=True,
            ),
            BodSession(
                id="BOD-40216",
                tenant_id="TNT-002",
                circuit_id="CKT-1002",
                route="MMR-B/R21 ──▶ Fabric-02",
                source_panel="XSOS-576D-2",
                source_port=48,
                target_panel="XSOS-576D-3",
                target_port=210,
                capacity="400G",
                sla_tier="Platinum",
                duration="Temporary Burst (24h)",
                stage=1,
                insertion_loss_db=0.46,
                return_loss_db=-64.2,
                est_switching_time_sec=38,
                monthly_cost=2400.0,
                auto_approved=True,
            ),
        ]
        db.add_all(bod_sessions)

        # 5. Sample Invoices
        invoices = [
            Invoice(
                id="INV-2026-0901",
                tenant_id="TNT-001",
                billing_period="September 2026",
                base_port_fee=14400.0,
                bod_burst_usage_hours=72.0,
                bod_burst_rate_per_hour=25.0,
                bod_burst_total=1800.0,
                sla_outage_downtime_min=0,
                sla_penalty_credit=0.0,
                subtotal=16200.0,
                tax_amount=1782.0,
                total_due=17982.0,
                status="Paid",
                due_date="2026-10-15",
            ),
            Invoice(
                id="INV-2026-0902",
                tenant_id="TNT-003",
                billing_period="September 2026",
                base_port_fee=8800.0,
                bod_burst_usage_hours=24.0,
                bod_burst_rate_per_hour=25.0,
                bod_burst_total=600.0,
                sla_outage_downtime_min=12,
                sla_penalty_credit=420.0,
                subtotal=8980.0,
                tax_amount=987.8,
                total_due=9967.8,
                status="Issued",
                due_date="2026-10-15",
            ),
        ]
        db.add_all(invoices)

        db.commit()
        logger.info("Seeding data awal berhasil diselesaikan!")
    except Exception as e:
        db.rollback()
        logger.error(f"Gagal melakukan seeding data: {e}")
        raise
    finally:
        db.close()
