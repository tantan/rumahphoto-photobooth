# Panduan Deployment & Konfigurasi Hardware

**Aplikasi Rumah Photobooth AI**

Dokumen ini berisi panduan teknis untuk mengonfigurasi dan melakukan *deployment* aplikasi Rumah Photobooth AI, baik untuk keperluan produksi di dalam studio (Lokal) maupun untuk keperluan presentasi (Web Demo).

---

## 1. Skenario Deployment

Aplikasi ini mendukung dua jenis arsitektur *deployment*:

1. **Produksi Studio (Offline / Local Area Network)**: Backend dan Frontend berjalan di satu PC/Laptop yang sama di dalam studio. Pelanggan terhubung ke jaringan WiFi lokal (Hotspot) untuk memindai QR Code. Fitur *Auto Print* **aktif**.
2. **Web Demo (Cloud)**: Frontend di-hosting di Vercel/Netlify, Backend di-hosting di Render/HuggingFace. Cocok untuk demo ke klien jarak jauh. Fitur *Auto Print* **tidak aktif** (hanya mode simulasi).

---

## 2. Persiapan Hardware & Jaringan

Jika Anda menjalankan skenario **Produksi Studio**, siapkan hal berikut:

- **PC/Laptop Host**: Minimal Core i3/i5, RAM 8GB. PC ini bertugas menjalankan sistem kamera, UI, dan memproses *Green Screen* (OpenCV).
- **Webcam**: Kamera USB *plug & play* dengan resolusi minimal 720p (direkomendasikan 1080p).
- **Printer (Epson SureLab D830 / sejenisnya)**:
  - Harus terhubung langsung ke PC Host via kabel USB.
  - Driver Windows resmi harus sudah terinstal.
  - Jadikan printer ini sebagai **"Default Printer"** di pengaturan Windows.
  - Atur ukuran kertas (*Paper Size*) default di driver Windows (Misal: 4R atau 2x6 inch).
- **Jaringan**:
  - Hidupkan fitur **Mobile Hotspot** di Windows PC Host, atau gunakan Router WiFi terpisah.
  - Pastikan PC Host memiliki IP Statis lokal (misal: `192.168.1.100`), sehingga URL QR Code tidak sering berubah.

---

## 3. Konfigurasi Backend (Python / FastAPI)

### A. Deployment Lokal (Produksi Studio)

Ini adalah metode wajib jika Anda ingin printer berfungsi.

1. Buka terminal (PowerShell/CMD), masuk ke folder `backend`.
2. Buat *virtual environment* (opsional tapi disarankan): `python -m venv venv` dan aktifkan `.\venv\Scripts\activate`.
3. Instal dependensi:

   ```bash
   pip install -r requirements.txt
   ```

   *(Pastikan menginstal di OS Windows agar library `pywin32` terinstal untuk fitur Auto Print).*
4. Jalankan server:

   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

5. Server backend Anda kini aktif di `http://localhost:8000`.

### B. Deployment Cloud (Web Demo) via Render.com

1. *Push* kode `backend` ke GitHub.
2. Buat akun di [Render.com](https://render.com) dan buat layanan **Web Service** baru.
3. Hubungkan *repository* GitHub Anda. Render akan mendeteksi `Dockerfile` secara otomatis.
4. Render akan menginstal paket *Linux-friendly* (seperti `opencv-python-headless`) dan mengabaikan `pywin32`.
5. Setelah selesai, Render akan memberikan URL (misal: `https://photobooth-api.onrender.com`).

### C. Deployment Cloud (Web Demo) via Hugging Face Spaces

Hugging Face Spaces sangat direkomendasikan karena 100% gratis dan dikhususkan untuk aplikasi AI/Python.

1. Buat akun di [Hugging Face](https://huggingface.co/) lalu masuk ke menu **Spaces** -> **Create new Space**.
2. Beri nama Space Anda, pilih lisensi, dan pilih **Docker** sebagai *Space SDK*. Pilih templat **Blank**.
3. *Clone* repositori Space tersebut ke komputer Anda, lalu *copy* semua isi dari folder `backend/` ke dalamnya.
4. **PENTING**: Hugging Face mewajibkan aplikasi berjalan di port **7860**. Buka file `Dockerfile` dan ubah baris terakhir menjadi:

   ```dockerfile
   EXPOSE 7860
   CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
   ```

5. Lakukan *commit* dan *push* ke Hugging Face. Space akan otomatis melakukan *Build*.
6. Setelah status *Running*, klik tombol tiga titik (Settings) di pojok kanan atas Space Anda, lalu pilih **"Embed this Space"** untuk mendapatkan URL *Direct API*-nya (biasanya berakhiran `.hf.space`). Gunakan URL tersebut sebagai `VITE_BACKEND_URL` di Frontend.

---

## 4. Konfigurasi Frontend (React + Vite)

### A. Mengatur Environment Variables (`.env`)

Di dalam folder `frontend/`, pastikan terdapat file `.env`. File ini digunakan untuk mengarahkan Frontend ke Backend yang tepat.

- **Untuk Lokal:**

  ```env
  VITE_BACKEND_URL=http://localhost:8000
  ```

- **Untuk Cloud/Web Demo:**

  ```env
  VITE_BACKEND_URL=https://photobooth-api.onrender.com
  ```

### B. Deployment Lokal (Menjalankan di Studio)

1. Buka terminal di folder `frontend/`.
2. Instal dependensi: `npm install` (hanya dilakukan sekali).
3. Jalankan server UI:

   ```bash
   npm run dev
   ```

4. Buka `http://localhost:5173` di *browser* (sebaiknya gunakan mode *Full Screen* F11 pada Chrome).

### C. Deployment Cloud (Vercel / Netlify)

1. *Push* kode `frontend` ke GitHub.
2. Buka dashboard Vercel/Netlify, pilih "Import Project" dari GitHub.
3. Di bagian **Environment Variables**, tambahkan *key*: `VITE_BACKEND_URL` dan *value* URL backend Render Anda.
4. Klik **Deploy**. Vercel akan secara otomatis menjalankan `npm run build` dan mempublikasikan UI Anda.

---

## 5. Panduan Kalibrasi Sistem (Admin Panel)

Setelah aplikasi berjalan di layar, Anda wajib melakukan pengaturan awal:

1. **Buka Admin Panel**: Klik ikon roda gigi (⚙️) di pojok kiri atas aplikasi.
2. **Kalibrasi Green Screen**:
   - Jika hasil potongan latar belakang kurang rapi, gunakan *slider* kalibrasi warna (Hue, Saturation, Value) di Admin Panel.
   - Angka *default* yang sering digunakan untuk layar hijau standar: `H: 35-85`, `S: 43-255`, `V: 46-255`.
3. **Manajemen Background**:
   - Upload file latar belakang (`.jpg` / `.png`) yang akan digunakan oleh pelanggan.
4. **Auto Print**:
   - Nyalakan *toggle* **Auto Print** jika Anda ingin foto langsung dicetak segera setelah proses selesai.
   - Jika opsi ini dimatikan, operator harus menekan tombol "Cetak Ulang" secara manual di layar hasil akhir.
