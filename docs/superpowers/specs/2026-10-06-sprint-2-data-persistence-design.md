# Design Specification: Sprint 2 — Data Persistence & Business Layer
**Xenoptics IXP Orchestration & BSS/OSS Platform**
**Tanggal:** 2026-10-06  
**Status:** Approved by User  

---

## 1. Ringkasan Eksekutif (*Executive Summary*)
Pada Sprint 1, antarmuka modular (Frontend Next.js) untuk 5 pilar siklus hidup IXP/DCI telah berhasil diimplementasikan dengan data tiruan (*mock state*). 
Sprint 2 bertujuan mentransformasikan sistem menjadi platform data persisten penuh (*persistent business layer*) dengan:
1. Membangun basis data relasional berbasis **SQLAlchemy 2.0** yang mendukung SQLite secara bawaan (`nms_business.db`) serta siap beralih ke PostgreSQL via `DATABASE_URL`.
2. Menyediakan modul ORM dan skema validasi Pydantic v2 untuk entitas bisnis utama: `Tenant`, `SlaPolicy`, `Circuit`, `BodSession`, `OutageIncident`, `Invoice`, dan `InvoiceItem`.
3. Mengembangkan seeder otomatis (*automatic seed data*) yang menginisialisasi konfigurasi baseline IXP saat start-up pertama.
4. Membangun router REST API `/business/*` pada `nms-proxy` (FastAPI) yang dilindungi oleh `X-API-Key`.
5. Memperbarui `nms-dashboard` (Next.js 14) agar dapat mengonsumsi data bisnis persisten secara live (CRUD Tenant, antrean BoD, dan pembuatan invoice dinamis).

---

## 2. Arsitektur & Struktur Direktori

### 2.1 Backend (`nms-proxy`)
```
nms-proxy/
├── app/
│   ├── config.py             # Menambahkan database_url & konfigurasi persistence
│   ├── main.py               # Mendaftarkan router business & memanggil startup seeder
│   ├── nms_client.py         # Klien hardware Xenoptics L1
│   └── db/
│       ├── __init__.py
│       ├── session.py        # SQLAlchemy engine, sessionmaker, get_db dependency
│       ├── models.py         # Definisi model tabel ORM
│       ├── schemas.py        # Pydantic v2 request & response schemas
│       ├── seed.py           # Inisialisasi seed data baseline
│       └── routers/
│           ├── __init__.py
│           └── business.py   # Endpoint REST API /business/*
├── requirements.txt          # SQLAlchemy>=2.0.30
└── nms_business.db           # SQLite persistence file (auto-generated)
```

### 2.2 Frontend (`nms-dashboard`)
```
nms-dashboard/
├── app/
│   └── api/
│       └── nms/
│           └── [...path]/
│               └── route.ts  # Ditambahkan handler PUT/PATCH dan perutean /business/*
├── lib/
│   └── business-api.ts       # Client-side helper untuk memanggil endpoint bisnis
└── app/components/nms-dashboard/
    ├── CrmBillingView.tsx     # Diperbarui untuk fetch & mutasi live dari database
    ├── BodOrchestratorView.tsx# Diperbarui untuk submit BoD ke database
    └── SlaAnalyticsView.tsx   # Menampilkan kepatuhan SLA dari database
```

---

## 3. Desain Model Basis Data (*Entity Models*)

### 3.1 `SlaPolicy` (`sla_policies`)
* `id`: `String(32)` (PK, e.g. `SLA-PLATINUM`, `SLA-GOLD`, `SLA-SILVER`)
* `tier_name`: `String(32)` (`Platinum`, `Gold`, `Silver`, `Bronze`)
* `uptime_target_pct`: `Float` (misal 99.999, 99.99, 99.95)
* `latency_target_ms`: `Float` (misal 1.0, 2.0, 5.0)
* `penalty_rate_pct`: `Float` (misal 10.0%)

### 3.2 `Tenant` (`tenants`)
* `id`: `String(32)` (PK, e.g. `TNT-001`)
* `name`: `String(128)`
* `asn`: `Integer`
* `customer_type`: `String(32)` (`Hyperscaler`, `CDN`, `FSI`, `Enterprise`)
* `contact_email`: `String(128)`
* `rack_location`: `String(64)`
* `contract_tier`: `String(32)`
* `monthly_base_commit`: `Float`
* `status`: `String(32)` (`Active`, `Suspended`, `Pending`)
* `created_at`: `DateTime`

### 3.3 `Circuit` (`circuits`)
* `id`: `String(32)` (PK, e.g. `CKT-1001`)
* `tenant_id`: `String(32)` (FK `tenants.id`)
* `sla_policy_id`: `String(32)` (FK `sla_policies.id`)
* `source_panel`: `String(64)`
* `source_port`: `Integer`
* `target_panel`: `String(64)`
* `target_port`: `Integer`
* `capacity`: `String(16)` (`10G`, `100G`, `400G`)
* `operational_status`: `String(32)` (`Connected`, `Standby`, `Degraded`, `Disconnected`)
* `activated_at`: `DateTime`

### 3.4 `BodSession` (`bod_sessions`)
* `id`: `String(32)` (PK, e.g. `BOD-40217`)
* `tenant_id`: `String(32)` (FK `tenants.id`)
* `circuit_id`: `String(32)` (FK `circuits.id`, nullable)
* `route`: `String(128)`
* `source_panel`: `String(64)`
* `source_port`: `Integer`
* `target_panel`: `String(64)`
* `target_port`: `Integer`
* `capacity`: `String(16)`
* `sla_tier`: `String(32)`
* `duration`: `String(64)`
* `stage`: `Integer` (0: Validating, 1: Configuring Hardware, 2: Activating, 3: Active)
* `insertion_loss_db`: `Float`
* `return_loss_db`: `Float`
* `est_switching_time_sec`: `Integer`
* `monthly_cost`: `Float`
* `auto_approved`: `Boolean`
* `created_at`: `DateTime`

### 3.5 `Invoice` (`invoices`) & `InvoiceItem` (`invoice_items`)
* **`invoices`**:
  * `id`: `String(32)` (PK, e.g. `INV-2026-1001`)
  * `tenant_id`: `String(32)` (FK `tenants.id`)
  * `billing_period`: `String(64)`
  * `base_port_fee`: `Float`
  * `bod_burst_usage_hours`: `Float`
  * `bod_burst_rate_per_hour`: `Float`
  * `bod_burst_total`: `Float`
  * `sla_outage_downtime_min`: `Integer`
  * `sla_penalty_credit`: `Float`
  * `subtotal`: `Float`
  * `tax_amount`: `Float`
  * `total_due`: `Float`
  * `status`: `String(32)` (`Draft`, `Issued`, `Paid`)
  * `due_date`: `String(32)`
  * `created_at`: `DateTime`

---

## 4. Spesifikasi REST API (`nms-proxy`)

Semua endpoint `/business/*` dilindungi otentikasi melalui header `X-API-Key` yang identik dengan endpoint `/live/*`.

| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/business/overview` | Statistik agregat: total tenant aktif, total sirkuit, total invoice, akumulasi billing. |
| `GET` | `/business/tenants` | Mengambil daftar seluruh tenant pelanggan. Filter by `status`, `tier`. |
| `POST`| `/business/tenants` | Mendaftarkan tenant baru. |
| `GET` | `/business/tenants/{id}` | Mengambil detail tenant beserta daftar sirkuit miliknya. |
| `GET` | `/business/circuits` | Mengambil seluruh sirkuit aktif & status operasional. |
| `POST`| `/business/circuits` | Menambahkan sirkuit baru ke tenant. |
| `GET` | `/business/sla/policies` | Mengambil daftar kebijakan SLA komersial. |
| `GET` | `/business/bod/requests` | Mengambil antrean permintaan Bandwidth on Demand. |
| `POST`| `/business/bod/requests` | Membuat permintaan BoD baru (termasuk kalkulasi loss optik). |
| `PATCH`| `/business/bod/requests/{id}/stage` | Memajukan tahapan provisioning BoD (0 -> 1 -> 2 -> 3). |
| `GET` | `/business/invoices` | Mengambil daftar faktur komersial tenant. |
| `POST`| `/business/invoices` | Menghasilkan faktur komersial baru berdasarkan formula metered billing. |
| `PATCH`| `/business/invoices/{id}/status` | Memperbarui status pembayaran (`Issued` -> `Paid`). |

---

## 5. Integrasi Frontend Next.js (`nms-dashboard`)

1. **Proxy Passthrough (`nms-dashboard/app/api/nms/[...path]/route.ts`)**:
   - Mendukung segmen `/business/*`.
   - Mengimplementasikan HTTP handler untuk `GET`, `POST`, `PATCH`, dan `DELETE`.
2. **Klien Bisnis Frontend (`nms-dashboard/lib/business-api.ts`)**:
   - Fungsi `getTenants()`, `createTenant()`, `getBodRequests()`, `createBodRequest()`, `getInvoices()`, `createInvoice()`, `updateInvoiceStatus()`.
3. **Penyempurnaan Komponen UI**:
   - `CrmBillingView`: Saat pertama kali dimuat (*on-mount*), mengambil data `tenants` dan `invoices` via API. Tombol "Generate Commercial Invoice" memicu `POST /api/nms/business/invoices` dan memperbarui state tanpa reload.
   - `BodOrchestratorView`: Membaca antrean dari `/api/nms/business/bod/requests` dan menyimpan hasil formulir BoD ke database.

---

## 6. Rencana Pengujian & Verifikasi Mutu

1. **Unit & Database Testing**:
   - Inisialisasi engine SQLite in-memory / file `nms_business.db`.
   - Verifikasi seeder berhasil mengisi 6 tenant, 3 SLA policy, initial circuits, dan sample invoices.
2. **API Verification via HTTP Test**:
   - Uji endpoint `/business/tenants` mengembalikan kode status 200 dengan data lengkap.
   - Uji pembuatan invoice baru via `POST /business/invoices` dan validasi kalkulasi Pajak 11% serta diskon kredit SLA.
3. **End-to-End Verification**:
   - Akses tab CRM & Billing di browser `http://localhost:3001/` atau `http://localhost:3000/`.
   - Verifikasi data tampil dinamis dari backend dan pembuatan invoice berhasil tersimpan persisten.
