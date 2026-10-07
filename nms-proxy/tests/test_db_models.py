"""
Unit test untuk lapisan persistensi database, ORM models, dan seeder.
"""
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.db.models import Tenant, SlaPolicy, Circuit, BodSession, Invoice
from app.db.seed import init_db_and_seed


def test_models_and_seeder():
    # Jalankan inisialisasi dan seeder
    init_db_and_seed()

    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        # Verifikasi data Tenant
        tenants = db.query(Tenant).all()
        assert len(tenants) >= 6
        tenant_1 = db.query(Tenant).filter_by(id="TNT-001").first()
        assert tenant_1 is not None
        assert tenant_1.name == "Google Global Cache & Peering"
        assert tenant_1.asn == 15169
        assert len(tenant_1.circuits) >= 1

        # Verifikasi SLA Policies
        sla_policies = db.query(SlaPolicy).all()
        assert len(sla_policies) >= 3

        # Verifikasi BoD Sessions
        bod_list = db.query(BodSession).all()
        assert len(bod_list) >= 2

        # Verifikasi Invoices
        invoices = db.query(Invoice).all()
        assert len(invoices) >= 2
        print("\n[SUCCESS] Semua model ORM dan seed data terverifikasi dengan benar!")
    finally:
        db.close()


if __name__ == "__main__":
    test_models_and_seeder()
