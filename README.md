# XSOS Fiber Cross-Connect Monitor & Remote Control

Sistem pemantauan dan pengendalian sakelar serat optik (optical switch) fisik Xenoptics XSOS secara remote melalui antarmuka web, terintegrasi dengan Xenoptics NMS API v2.0.2.2.

---

## 1. Arsitektur Monorepo

```
e:\Project\Nms\
├── docker-compose.yml              # Jalankan backend + dashboard sekaligus
├── README.md                       # Dokumentasi utama monorepo
│
├── nms-proxy/                      # BACKEND SERVICE (FastAPI)
│   ├── app/
│   │   ├── main.py                 # Endpoint /health, /live/*, /control/*
│   │   ├── config.py               # Konfigurasi & security settings
│   │   └── nms_client.py           # HTTP Client NMS & token refresh otomatis
│   ├── .env                        # Konfigurasi aktif kredensial NMS
│   ├── requirements.txt
│   └── Dockerfile
│
└── nms-dashboard/                  # FRONTEND APPLICATION (Next.js 14 App Router)
    ├── app/
    │   ├── api/nms/[...path]/
    │   │   └── route.ts            # Route handler server-side (GET & POST)
    │   ├── components/nms-dashboard/
    │   │   ├── NmsDashboard.tsx    # Dashboard utama
    │   │   ├── ConnectModal.tsx    # Modal Remote Connect port fiber
    │   │   ├── DisconnectModal.tsx # Modal interlock Remote Disconnect
    │   │   └── NmsDashboard.module.css
    │   ├── dashboard/page.tsx
    │   ├── layout.tsx
    │   └── page.tsx
    ├── lib/
    │   ├── nms-api.ts              # Server-side proxy fetch & post
    │   └── mock-nms-data.ts        # Data simulasi saat offline/demo
    ├── types/
    │   └── nms.ts                  # Skema TypeScript NMS v2
    ├── .env.local                  # Konfigurasi koneksi ke nms-proxy
    ├── package.json
    └── Dockerfile
```

---

## 2. Fitur Utama

- **Remote Port Monitoring**: Matriks visual 288 port (East & West) untuk tiap patch panel XSOS, status real-time (`Available`, `Connected`, `Disabled`, `Reserved`), dan ringkasan port.
- **Remote Connect**: Membuat koneksi silang (*cross-connect*) baru antar-port fiber yang berstatus *Available*, mendukung eksekusi seketika maupun terjadwal (*scheduled*).
- **Remote Disconnect**: Memutuskan sambungan port aktif dengan perlindungan *Safety Interlock Confirmation* 2 langkah untuk mencegah salah cabut kabel/sinyal aktif.
- **Task Queue & Active Connections**: Memantau antrean tugas robotik XSOS dan daftar seluruh koneksi optik aktif.
- **Graceful Fallback / Demo Mode**: Jika proxy/NMS belum online, dashboard otomatis beralih ke mode demo interaktif untuk pengujian tanpa error.

---

## 3. Cara Menjalankan

### Opsi A: Menjalankan Bersamaan via Docker
```bash
docker compose up --build
```
- Dashboard dapat diakses di: `http://localhost:3000`
- Proxy FastAPI di: `http://localhost:8000`

### Opsi B: Menjalankan Secara Lokal

#### 1. Jalankan Backend Proxy:
```bash
cd nms-proxy
python -m uvicorn app.main:app --reload --port 8000
```
Cek kesehatan: `curl http://localhost:8000/health`

#### 2. Jalankan Frontend Dashboard:
```bash
cd nms-dashboard
npm install
npm run dev
```
Buka browser di `http://localhost:3000`.
