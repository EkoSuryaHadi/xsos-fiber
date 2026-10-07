"""
Unit tests for SLA Calculation Engine.
"""
import pytest
from app.services.sla_engine import (
    calculate_availability_pct,
    evaluate_tier_compliance,
    calculate_sla_penalty,
    get_sla_compliance_summary,
    ROLLING_PERIOD_MINUTES,
)
from app.db.session import SessionLocal
from app.db.seed import init_db_and_seed


def test_calculate_availability():
    # 0 menit downtime -> 100%
    assert calculate_availability_pct(0.0) == 100.0
    assert calculate_availability_pct(-5.0) == 100.0

    # 43.2 menit downtime pada periode 43,200 menit -> 99.9%
    assert calculate_availability_pct(43.2) == 99.9

    # 4.32 menit downtime -> 99.99%
    assert calculate_availability_pct(4.32) == 99.99

    # Total outage 43,200 menit -> 0%
    assert calculate_availability_pct(ROLLING_PERIOD_MINUTES) == 0.0


def test_evaluate_tier_compliance():
    # Platinum (target: 99.999%, latency: 1.0ms)
    assert evaluate_tier_compliance(99.9995, 0.5, "Platinum") == "Good"
    # Latensi 0.8ms mendekati 1.0ms (gap 0.2ms) -> Watch
    assert evaluate_tier_compliance(99.9995, 0.8, "Platinum") == "Watch"
    # Uptime di bawah target -> Breach
    assert evaluate_tier_compliance(99.998, 0.5, "Platinum") == "Breach"

    # Gold (target: 99.99%, latency: 2.0ms)
    assert evaluate_tier_compliance(99.995, 1.2, "Gold") == "Good"
    assert evaluate_tier_compliance(99.985, 1.2, "Gold") == "Breach"


def test_calculate_sla_penalty():
    # Platinum: max toleransi 0.432 menit, $35/menit
    assert calculate_sla_penalty(0.2, "Platinum") == 0.0
    # 10.432 menit -> breach 10 menit x $35 = $350.0
    assert calculate_sla_penalty(10.432, "Platinum") == 350.0

    # Gold: max toleransi 4.32 menit, $25/menit
    assert calculate_sla_penalty(2.0, "Gold") == 0.0
    # 14.32 menit -> breach 10 menit x $25 = $250.0
    assert calculate_sla_penalty(14.32, "Gold") == 250.0


def test_sla_compliance_summary_db():
    init_db_and_seed()
    db = SessionLocal()
    try:
        summary = get_sla_compliance_summary(db)
        assert len(summary) == 4
        # Harus memuat segmen Hyperscaler, CDN, FSI, Enterprise
        types = [s["customer_type"] for s in summary]
        assert "Hyperscaler" in types
        assert "FSI (Financial Services)" in types
        for s in summary:
            assert s["actual_uptime_pct"] >= 0.0
            assert s["status"] in ["Good", "Watch", "Breach"]
    finally:
        db.close()
