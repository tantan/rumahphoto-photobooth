# Product Requirements Document (PRD)
## Aplikasi Photobooth AI (Fase 1: Freemium Cloud AI)

### 1. Pendahuluan
**Tujuan Proyek:** Membangun aplikasi desktop photobooth profesional untuk studio foto. Aplikasi ini dirancang untuk studio dengan menyediakan fitur-fitur modern seperti mode pengambilan standar dan mode AI tingkat lanjut, sekaligus menekan biaya awal serendah mungkin menggunakan solusi *Cloud API Freemium* untuk MVP.

### 2. Tujuan Bisnis & Scope MVP
Karena batasan hardware (ketiadaan GPU diskrit lokal yang kuat) dan belum adanya anggaran operasional API, MVP (Fase 1) akan menggunakan **API Cloud Pihak Ketiga dengan tier Gratis/Freemium**. 
*Penting untuk dicatat bahwa penggunaan API gratis memiliki batasan seperti antrian proses yang lebih lambat, watermark, atau limit kuota harian. Hal ini akan dikomunikasikan secara transparan melalui UI agar pelanggan tetap nyaman.*

### 3. Kebutuhan Pengguna (Features)
#### A. Antarmuka Pelanggan (Client-Facing UI)
1. **Pilihan Orientasi & Mode**: Memilih mode *Landscape* atau *Portrait*, serta memilih Mode Standar (Cepat) atau Mode AI.
2. **Sesi Foto Webcam**: Live preview dari Webcam dengan fitur *countdown* otomatis.
3. **Pemrosesan Mode Standar (Offline)**: Menggabungkan foto langsung dengan template bingkai (PNG) secara instan.
4. **Pemrosesan Mode AI (Online)**:
   - **Hapus Background**: Memotong subjek dan menggantinya dengan latar belakang pilihan.
   - **Beauty Filter**: Menghaluskan tekstur kulit wajah.
   - **Style Transfer**: Mengubah foto menjadi kartun/lukisan digital.
   - **Custom AI Template**: Menggunakan template *prompt* buatan admin.
5. **Review Hasil**: Menampilkan foto final di layar.
6. **Output Ganda**: 
   - Mencetak foto otomatis ke printer.
   - Menampilkan QR Code di layar. Pelanggan memindai QR Code untuk mengunduh foto digital ke HP masing-masing melalui jaringan WiFi lokal (tanpa kuota internet).

#### B. Antarmuka Admin (Operator Panel)
1. **Manajemen Ukuran Kertas**: Admin dapat menambah/memilih format cetak (contoh: 4R, 4x6, Photo Strip).
2. **Pengaturan Prompt AI**: Admin dapat meracik instruksi (prompt) AI khusus dan menyimpannya sebagai "Template" (misal: "Make the subject look like a retro 80s cyberpunk character").
3. **Manajemen API Key**: Admin dapat memasukkan atau mengganti *API Key* layanan gratis (seperti Hugging Face Token, Photoroom Free API) untuk meminimalisir kendala kuota habis.

#### C. Versi Web Demo
Membangun dan mendeploy antarmuka (React UI) ke platform hosting web gratis (Vercel/Netlify) agar studio foto dapat mendemokan UX dan flow aplikasi ke klien mereka secara *online* tanpa harus membawa PC.

### 4. Kebutuhan Sistem (System Requirements)
- **Kamera:** Webcam standar (Plug & Play). (Support DSLR direncanakan untuk Fase 2).
- **Printer:** Printer foto jenis apapun yang memiliki driver Windows (DNP, Epson, Canon).
- **Jaringan:** 
  - Koneksi Internet (WiFi/Tethering 4G) **wajib** untuk menjalankan Mode AI.
  - Jaringan WiFi Lokal (Hotspot) diperlukan agar pelanggan bisa scan QR Code.
- **Hardware PC:** Standar Desktop/Laptop (Core i3/i5, RAM 8GB). Tidak perlu GPU mahal.

### 5. Arsitektur Teknis
- **UI Framework:** Electron.js + React.js + TailwindCSS.
- **Backend Service:** Python (FastAPI).
- **AI Gateway:** Menggunakan `requests`/`httpx` Python untuk menghubungi endpoint penyedia API Gratis. Prioritas utama: Hugging Face Inference API (gratis) untuk Stable Diffusion (Style/Prompt), dan API penghapus background gratisan.
- **Local Database:** SQLite (Sangat ringan, zero-configuration).

### 6. Mitigasi Risiko & Limitasi API Gratis
| Risiko | Mitigasi / Solusi di Aplikasi |
| :--- | :--- |
| **Kuota Harian Habis** | Sistem akan mendeteksi *error limit* dan menampilkan peringatan ke operator untuk beralih ke Mode Standar atau mengganti API Key. |
| **Loading AI Lambat** | Menampilkan animasi *loading screen* interaktif atau tips/trivia yang menarik di UI agar pelanggan tidak merasa menunggu lama (bisa 10-20 detik). |
| **Kualitas Terbatas** | Fitur "Custom Prompt" harus diuji coba dan dikunci oleh admin untuk memastikan hasil generate AI tidak aneh/cacat. |
