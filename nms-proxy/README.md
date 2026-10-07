# NMS Proxy

Backend penghubung antara dashboard (browser) dan NMS API (`/mnt` internal network).
Menyimpan `access_token`/`refresh_token` NMS di sisi server — dashboard tidak pernah
menyentuh kredensial NMS secara langsung.

```
Browser (dashboard)  ──X-API-Key──►  NMS Proxy (FastAPI)  ──Bearer token──►  NMS (internal)
```

## Jalankan lokal

```bash
cd nms-proxy
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# edit .env: isi NMS_USERNAME, NMS_PASSWORD, PROXY_API_KEY

uvicorn app.main:app --reload --port 8000
```

Cek: `curl -H "X-API-Key: <PROXY_API_KEY>" http://localhost:8000/live/ports/summary`

## Jalankan via Podman

```bash
cd nms-proxy
cp .env.example .env   # isi seperti di atas
podman compose up --build -d
# atau: podman-compose up --build -d
```

## Endpoint yang tersedia

| Method | Path | Keterangan |
|---|---|---|
| GET | `/health` | Cek proxy hidup, tidak butuh API key |
| GET | `/live/system-status` | Status sistem NMS |
| GET | `/live/ports/summary` | Ringkasan jumlah port per status |
| GET | `/live/ports` | Detail port, mendukung `search`, `status`, `smu_type`, `limit`, `offset`, `ordering` |
| GET | `/live/connections` | Semua koneksi aktif |
| GET | `/live/queue` | Antrian tugas connect/disconnect |
| GET | `/live/inventory` | Daftar unit XSOS terdaftar |
| POST | `/control/connect` | Buat koneksi — **nonaktif default**, set `ENABLE_CONTROL_ENDPOINTS=true` |
| POST | `/control/disconnect` | Putus koneksi by panel+port — nonaktif default |
| POST | `/control/disconnect/{id}` | Putus koneksi by connection_id — nonaktif default |

Semua endpoint `/live/*` dan `/control/*` wajib header:
```
X-API-Key: <PROXY_API_KEY dari .env>
```

## Menghubungkan ke dashboard (nms-dashboard.html)

Dashboard yang sudah dibuat sebelumnya masih pakai data mock (`buildInitialState()`).
Untuk mengarahkannya ke data live, ganti bagian `useState`/`useEffect` di dashboard
dengan fetch ke proxy ini, contoh:

```javascript
const API_BASE = "http://localhost:8000";
const API_KEY = "isi-sesuai-.env";

async function fetchLive(path, params = {}) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { "X-API-Key": API_KEY } });
  if (!res.ok) throw new Error(`Gagal fetch ${path}: ${res.status}`);
  return res.json();
}

// dipanggil tiap interval polling, ganti fungsi buildInitialState()
async function loadLiveState() {
  const [summary, connections, ports, queue] = await Promise.all([
    fetchLive("/live/ports/summary"),
    fetchLive("/live/connections"),
    fetchLive("/live/ports", { limit: 10000 }),
    fetchLive("/live/queue"),
  ]);
  return { summary, connections: connections.items, ports: ports.items, queue: queue.items };
}
```

**Catatan penting:** artifact/HTML yang dipublikasikan di claude.ai tidak bisa memanggil
`localhost` atau IP internal (dibatasi content-security-policy ke beberapa CDN saja).
Jadi untuk uji coba data live, jalankan dashboard sebagai file HTML biasa di browser lokal
(bukan sebagai published artifact), atau — jika ingin tetap pakai versi Next.js — jalankan
`npm run dev` di project Eko dan panggil proxy ini dari situ.

## Langkah lanjutan (Fase 2 & 3)

- **Logging**: tambahkan worker terpisah yang polling `/live/connections` tiap beberapa
  detik dan insert ke TimescaleDB (`nms_connection_log`) sesuai skema di
  `NMS_API_Integration_Plan.md`.
- **Controlling**: setelah endpoint `/control/*` diuji di sandbox, set
  `ENABLE_CONTROL_ENDPOINTS=true` dan tambahkan pengecekan status port
  (`Available`/`Connected`) sebelum eksekusi, sesuai prasyarat di dokumen API.
