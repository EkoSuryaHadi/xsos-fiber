# NMS Dashboard — komponen Next.js

Versi App Router dari dashboard XSOS Fiber Monitor, sudah disambungkan ke
`nms-proxy` (bukan lagi data mock statis di browser).

## Struktur file

```
types/nms.ts                                  tipe data sesuai skema NMS API
lib/nms-api.ts                                 fetch ke proxy — SERVER-ONLY (pegang API key)
lib/mock-nms-data.ts                           generator data contoh (fallback, aman di client)
app/api/nms/[...path]/route.ts                 route handler: /api/nms/* -> proxy /live/*
app/components/nms-dashboard/NmsDashboard.tsx  komponen utama (client component)
app/components/nms-dashboard/NmsDashboard.module.css
app/dashboard/page.tsx                         contoh halaman yang merender dashboard
.env.local.example
```

## Cara pasang di project Next.js yang sudah ada (App Router)

1. Salin folder `types/`, `lib/`, `app/api/nms/`, `app/components/nms-dashboard/`
   ke root project Eko (merge, jangan timpa file lain).
2. Pastikan `tsconfig.json` punya path alias `@/*` mengarah ke root:
   ```json
   { "compilerOptions": { "paths": { "@/*": ["./*"] } } }
   ```
   (default `create-next-app` biasanya sudah begini.)
3. Salin `.env.local.example` → `.env.local`, isi `NMS_PROXY_BASE_URL` dan
   `NMS_PROXY_API_KEY` (samakan dengan `PROXY_API_KEY` di `nms-proxy/.env`).
4. Tambahkan halaman/route yang merender `<NmsDashboard />`, atau pakai
   contoh `app/dashboard/page.tsx` langsung.
5. (Opsional, tapi disarankan) load font IBM Plex lewat `next/font/google` di
   `app/layout.tsx` supaya tipografi sama persis dengan versi artifact:
   ```tsx
   import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
   const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400","500","600","700"], variable: "--font-sans" });
   const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400","500","600"], variable: "--font-mono" });
   // lalu tempel plexSans.variable + plexMono.variable di className <html>/<body>
   ```
   Tanpa langkah ini pun dashboard tetap jalan — CSS module sudah punya
   fallback ke font sistem.

## Jalankan

```bash
npm run dev
```

Buka `/dashboard`. Selama `nms-proxy` belum jalan, dashboard otomatis
menampilkan data contoh + badge "mode demo — proxy belum tersambung" di
kanan atas. Begitu `nms-proxy` aktif dan `.env.local` terisi benar, badge
hilang dan data mengikuti kondisi NMS sungguhan (polling tiap 8 detik).

## Alur keamanan

```
Browser  ──(same-origin, tanpa API key)──►  /api/nms/*  (Route Handler, server)
                                                  │
                                     tambahkan X-API-Key
                                                  ▼
                                          nms-proxy (FastAPI)
                                                  │
                                       Bearer <access_token>
                                                  ▼
                                          NMS (jaringan internal)
```

`NMS_PROXY_API_KEY` hanya pernah dibaca di `lib/nms-api.ts`, yang hanya
dipakai dari `app/api/nms/[...path]/route.ts` (kode server). Komponen
`NmsDashboard.tsx` (client) tidak pernah menyentuh key ini — dia cuma
`fetch("/api/nms/...")` same-origin.

## Langkah lanjut

- Endpoint controlling (`/control/connect`, `/control/disconnect`) di proxy
  belum dipakai di dashboard ini — dashboard masih read-only sesuai urutan
  kerja: Monitoring → Logging → Controlling. Begitu siap, tambahkan route
  handler `POST /api/nms/control/...` dengan pola yang sama, plus dialog
  konfirmasi di UI sebelum memanggilnya (memutus/menyambung port fisik
  adalah aksi yang berdampak nyata di lapangan).
