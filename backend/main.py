import base64
import os
import time
import socket
import asyncio
import shutil
import numpy as np
import cv2
from io import BytesIO
from PIL import Image, ImageOps, ImageDraw, ImageFont
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="Photobooth AI Backend")

# Pastikan folder downloads dan assets ada
DOWNLOADS_DIR = os.path.join(os.path.dirname(__file__), "downloads")
ASSETS_DIR = os.path.join(os.path.dirname(__file__), "assets")
ASSETS_BGS_DIR = os.path.join(ASSETS_DIR, "backgrounds")

os.makedirs(DOWNLOADS_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)
os.makedirs(ASSETS_BGS_DIR, exist_ok=True)

# Mount folder static
app.mount("/downloads", StaticFiles(directory=DOWNLOADS_DIR), name="downloads")
app.mount("/backgrounds-static", StaticFiles(directory=ASSETS_BGS_DIR), name="backgrounds-static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_local_ip():
    """Mengambil IP Address Lokal (LAN) dari mesin host"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

class ImageProcessRequest(BaseModel):
    image_base64: str
    mode: str
    prompt: str = ""
    background_filename: str = ""
    hsv_lower: list = [35, 43, 46]
    hsv_upper: list = [85, 255, 255]

class PrintRequest(BaseModel):
    filename: str

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Photobooth AI Backend is running"}

# --- ENDPOINT PRINTING ---

@app.post("/print")
async def print_image(request: PrintRequest):
    """
    Endpoint untuk mencetak foto secara silent menggunakan Windows Print Spooler.
    Hanya bekerja secara native di OS Windows (diabaikan jika di Cloud/Linux).
    """
    filepath = os.path.join(DOWNLOADS_DIR, request.filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File gambar tidak ditemukan di server.")
        
    if os.name != 'nt':
        return {"status": "success", "message": f"Simulasi Cetak Selesai (OS bukan Windows)"}
        
    try:
        import win32print
        import win32ui
        from PIL import ImageWin
        
        printer_name = win32print.GetDefaultPrinter()
        
        hDC = win32ui.CreateDC()
        hDC.CreatePrinterDC(printer_name)
        
        img = Image.open(filepath)
        if img.mode != 'RGB':
            img = img.convert('RGB')
            
        hDC.StartDoc(filepath)
        hDC.StartPage()
        
        dib = ImageWin.Dib(img)
        physical_width = hDC.GetDeviceCaps(110) # PHYSICALWIDTH
        physical_height = hDC.GetDeviceCaps(111) # PHYSICALHEIGHT
        
        # --- LOGIKA SMART CROP (ANTI DISTORSI) ---
        img_width, img_height = img.size
        
        # 1. Samakan orientasi (Portrait/Landscape) agar tidak banyak terpotong
        is_printer_landscape = physical_width > physical_height
        is_img_landscape = img_width > img_height
        
        if is_printer_landscape != is_img_landscape:
            # Putar gambar 90 derajat
            img = img.rotate(90, expand=True)
            img_width, img_height = img.size
            
        # 2. Hitung rasio
        printer_ratio = physical_width / physical_height
        img_ratio = img_width / img_height
        
        # 3. Center Crop
        if img_ratio > printer_ratio:
            # Gambar terlalu lebar, potong kiri & kanan
            new_width = int(printer_ratio * img_height)
            offset = (img_width - new_width) // 2
            img = img.crop((offset, 0, offset + new_width, img_height))
        else:
            # Gambar terlalu tinggi, potong atas & bawah
            new_height = int(img_width / printer_ratio)
            offset = (img_height - new_height) // 2
            img = img.crop((0, offset, img_width, offset + new_height))
            
        # Update DIB dengan gambar yang sudah di-crop
        dib = ImageWin.Dib(img)
        
        # Gambar di kanvas printer (sekarang rasionya sudah 1:1 persis dengan kertas)
        dib.draw(hDC.GetHandleOutput(), (0, 0, physical_width, physical_height))
        
        hDC.EndPage()
        hDC.EndDoc()
        hDC.DeleteDC()
        
        return {"status": "success", "message": f"Berhasil mengirim ke {printer_name}"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mencetak: {str(e)}")

# --- ENDPOINT BACKGROUNDS ---

@app.get("/backgrounds")
def list_backgrounds():
    """Mengembalikan daftar gambar background yang tersedia di server"""
    bg_files = []
    if os.path.exists(ASSETS_BGS_DIR):
        for f in os.listdir(ASSETS_BGS_DIR):
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                url = f"http://{get_local_ip()}:8000/backgrounds-static/{f}"
                bg_files.append({"filename": f, "url": url})
    return {"status": "success", "backgrounds": bg_files}

@app.post("/upload-background")
async def upload_background(file: UploadFile = File(...)):
    """Upload gambar background baru"""
    try:
        filepath = os.path.join(ASSETS_BGS_DIR, file.filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"status": "success", "message": f"Berhasil upload {file.filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/backgrounds/{filename}")
def delete_background(filename: str):
    filepath = os.path.join(ASSETS_BGS_DIR, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        return {"status": "success", "message": "File dihapus"}
    raise HTTPException(status_code=404, detail="File tidak ditemukan")


# --- ENDPOINT PROCESS IMAGE ---

def apply_green_screen(image_bytes, bg_filename, hsv_lower_val, hsv_upper_val):
    """
    Menggunakan OpenCV untuk mendeteksi warna hijau (Chroma Key)
    dan menggantinya dengan gambar background pilihan.
    """
    # 1. Decode bytes ke numpy array untuk OpenCV
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Jika tidak ada gambar atau decode gagal
    if img is None:
        raise Exception("Gagal decode gambar dari Base64")

    # 2. Konversi BGR ke HSV untuk kemudahan mendeteksi rentang warna
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # 3. Tentukan batas warna dari request parameter
    lower_green = np.array(hsv_lower_val, dtype=np.uint8)
    upper_green = np.array(hsv_upper_val, dtype=np.uint8)
    
    # 4. Buat Mask untuk piksel hijau
    mask = cv2.inRange(hsv, lower_green, upper_green)
    
    # Pelembutan tepi mask agar potongan tidak kasar
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.dilate(mask, kernel, iterations=1)
    
    mask_inv = cv2.bitwise_not(mask)
    
    # 5. Ekstrak subjek (Foreground / Non-hijau)
    fg = cv2.bitwise_and(img, img, mask=mask_inv)
    
    # 6. Load Background Image
    bg_path = os.path.join(ASSETS_BGS_DIR, bg_filename)
    if not os.path.exists(bg_path):
        raise Exception("Background file tidak ditemukan di server")
        
    bg_img = cv2.imread(bg_path)
    if bg_img is None:
         raise Exception("Gagal membaca file background")
         
    # Resize background agar ukurannya pas dengan resolusi foto kamera
    bg_img = cv2.resize(bg_img, (img.shape[1], img.shape[0]))
    
    # 7. Ekstrak area background yang bersesuaian dengan posisi area hijau
    bg_masked = cv2.bitwise_and(bg_img, bg_img, mask=mask)
    
    # 8. Gabungkan Subjek (Foreground) dan Background baru
    final_img = cv2.add(fg, bg_masked)
    
    # 9. Encode kembali ke bytes (JPEG)
    success, encoded_img = cv2.imencode('.jpg', final_img, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if not success:
         raise Exception("Gagal encode gambar akhir")
         
    return encoded_img.tobytes()

@app.post("/process-image")
async def process_image(request: ImageProcessRequest):
    try:
        image_data = request.image_base64
        prefix = ""
        if "," in image_data:
            prefix, image_data = image_data.split(",", 1)
            prefix = prefix + ","
            
        image_bytes = base64.b64decode(image_data)
        final_image_bytes = image_bytes
        message = "Standard process success"
        
        if request.mode == "Standard":
            # --- PROSES GREEN SCREEN ---
            if request.background_filename:
                try:
                    final_image_bytes = apply_green_screen(
                        image_bytes, 
                        request.background_filename,
                        request.hsv_lower,
                        request.hsv_upper
                    )
                    message = f"Green Screen berhasil diterapkan dengan latar {request.background_filename}"
                except Exception as e:
                    message = f"Green Screen Gagal: {e}"
            else:
                 message = "Tidak ada background dipilih, menggunakan foto asli."
            
        elif request.mode == "AI":
            await asyncio.sleep(3) # Mock delay
            try:
                img = Image.open(BytesIO(image_bytes))
                gray_img = ImageOps.grayscale(img)
                buffered = BytesIO()
                gray_img.save(buffered, format="JPEG")
                final_image_bytes = buffered.getvalue()
                message = "AI processing simulated (Grayscale filter applied)"
            except Exception as e:
                message = f"Fallback to original. Error applying filter: {e}"
                
        else:
            raise HTTPException(status_code=400, detail="Unknown mode")
            
        # Simpan file ke disk (folder downloads)
        filename = f"photo_{int(time.time())}.jpg"
        filepath = os.path.join(DOWNLOADS_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(final_image_bytes)
            
        # Buat URL Download untuk QR Code
        local_ip = get_local_ip()
        download_url = f"http://{local_ip}:8000/downloads/{filename}"
        
        # Konversi kembali ke base64
        final_image_base64 = base64.b64encode(final_image_bytes).decode('utf-8')
            
        return {
            "status": "success", 
            "processed_image_base64": f"{prefix}{final_image_base64}",
            "download_url": download_url,
            "filename": filename,
            "message": message
        }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
