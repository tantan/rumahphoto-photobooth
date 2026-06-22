FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Salin file requirements
COPY requirements.txt .

# Install dependensi menggunakan versi opencv-python-headless 
# (Sangat direkomendasikan untuk Docker karena tidak membutuhkan libgl1 C++ library UI)
RUN pip install --no-cache-dir -r requirements.txt

# Salin seluruh kode backend
COPY . .

# Buat direktori lokal yang dibutuhkan script agar tidak terjadi error folder not found
RUN mkdir -p downloads assets/backgrounds

# Buka port 8000 untuk FastAPI
EXPOSE 8000

# Perintah untuk menjalankan server menggunakan Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
