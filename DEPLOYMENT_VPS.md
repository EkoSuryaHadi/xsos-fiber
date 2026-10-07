# Panduan Deployment NMS Platform ke VPS (Docker & Docker Compose)

Panduan langkah demi langkah untuk men-deploy aplikasi **NMS Platform (Backend FastAPI + Frontend Next.js)** ke VPS (Ubuntu 20.04/22.04/24.04 LTS).

---

## Spesifikasi Minimum VPS yang Disarankan
- **OS**: Ubuntu 22.04 LTS atau 24.04 LTS (x86_64)
- **CPU**: 1-2 vCPU
- **RAM**: Minimal 2 GB (Disarankan 4 GB untuk build Next.js yang lancar)
- **Disk**: 20+ GB SSD
- **Port Terbuka**: 80 (HTTP), 443 (HTTPS), 22 (SSH)

---

## Langkah 1: Persiapan VPS & Instalasi Docker

Login ke VPS via SSH:
```bash
ssh root@<IP_VPS_ANDA>
```

Update package dan instal dependensi dasar:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw
```

Instal Docker & Docker Compose Plugin resmi:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo systemctl enable --now docker
```

Verifikasi instalasi Docker:
```bash
docker --version
docker compose version
```

---

## Langkah 2: Salin / Clone Proyek ke VPS

Buat direktori kerja di `/var/www` atau `/opt`:
```bash
mkdir -p /var/www/nms
cd /var/www/nms
```

### Opsi A: Menggunakan Git (Direkomendasikan)
```bash
git clone <URL_REPOSITORY_ANDA> .
```

### Opsi B: Transfer File via SCP/Rsync dari Komputer Lokal
Jalankan dari komputer lokal (PowerShell):
```powershell
scp -r e:\Project\Nms\* root@<IP_VPS_ANDA>:/var/www/nms/
```

---

## Langkah 3: Konfigurasi Environment Variable (`.env`)

Salin dan sesuaikan file environment untuk backend proxy:

```bash
cd /var/www/nms/nms-proxy
cp .env.example .env
nano .env
```

Pastikan isi `.env` sudah benar:
```ini
# Kredensial NMS API v2 (Hardware Xenoptics)
NMS_BASE_URL=https://nms2-sandbox.xenoptics.co/api/v2
NMS_USERNAME=Admin
NMS_PASSWORD=Admin
NMS_LOGIN_MODE=

# Keamanan internal proxy
PROXY_API_KEY=nms-secret-key-remote-2026

# Origin yang diizinkan (ganti dengan IP atau domain VPS Anda)
ALLOWED_ORIGINS=http://localhost:3000,http://<IP_VPS>:3000,https://<DOMAIN_ANDA>

# Fitur Kontrol (wajib true untuk mengaktifkan connect/disconnect)
ENABLE_CONTROL_ENDPOINTS=true
```
*(Tekan `Ctrl + O` lalu `Enter` untuk menyimpan, `Ctrl + X` untuk keluar dari nano)*

---

## Langkah 4: Jalankan Aplikasi Menggunakan Docker Compose

Kembali ke root direktori proyek `/var/www/nms` dan jalankan build container:

```bash
cd /var/www/nms
docker compose up -d --build
```

Cek status container yang sedang berjalan:
```bash
docker compose ps
```
Hasil yang diharapkan:
- Container `nms-proxy` status `Up` (Port 8000)
- Container `nms-dashboard` status `Up` (Port 3000)

Cek log backend & frontend:
```bash
docker compose logs -f
```

Uji kesehatan endpoint proxy:
```bash
curl http://localhost:8000/health
# Output yang diharapkan: {"status":"ok"}
```

---

## Langkah 5: Konfigurasi Nginx Reverse Proxy & SSL (Domain)

Agar aplikasi dapat diakses publik melalui port standar 80 & 443 (HTTPS):

1. **Instal Nginx & Certbot**:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. **Pasang Konfigurasi Nginx**:
   Salin file konfigurasi dari template proyek:
   ```bash
   sudo cp /var/www/nms/nginx/nginx.conf /etc/nginx/sites-available/nms.conf
   ```

   Buka dan sesuaikan nama domain Anda:
   ```bash
   sudo nano /etc/nginx/sites-available/nms.conf
   # Ubah baris: server_name nms.your-domain.com; -> ganti dengan domain Anda
   ```

3. **Aktifkan Konfigurasi**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/nms.conf /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ```

4. **Pasang Sertifikat SSL Gratis (Let's Encrypt)**:
   ```bash
   sudo certbot --nginx -d nms.your-domain.com
   ```
   Ikuti petunjuk di layar (masukkan email dan setujui ToS). Certbot akan secara otomatis mengonfigurasi SSL dan auto-renewal.

---

## Langkah 6: Konfigurasi Firewall (UFW)

Pastikan port SSH, HTTP, dan HTTPS dibuka di VPS:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## Langkah 7: Perintah Operasional & Pemeliharaan

- **Melihat log real-time**:
  ```bash
  docker compose logs -f nms-dashboard
  docker compose logs -f nms-proxy
  ```

- **Restart container**:
  ```bash
  docker compose restart
  ```

- **Update kode terbaru setelah ada perubahan git**:
  ```bash
  git pull origin main
  docker compose up -d --build
  ```

- **Backup Basis Data SQLite**:
  Data bisnis (kontrak tenant, rate plan, outage incidents) tersimpan secara persisten pada Docker volume `nms-data`:
  ```bash
  docker compose exec nms-proxy cp /app/data/nms_business.db /app/data/nms_business_backup_$(date +%F).db
  ```
