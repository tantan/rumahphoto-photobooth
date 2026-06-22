import { useRef, useEffect, useState } from 'react';
import { Camera as CameraIcon, X } from 'lucide-react';

export default function Camera({ mode, backgroundUrl, onCapture, onCancel }) {
  const videoRef = useRef(null);
  const displayCanvasRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [countdown, setCountdown] = useState(null);
  
  const animationFrameId = useRef(null);
  const bgImage = useRef(null);

  // Load Background Image if in Standard mode
  useEffect(() => {
    if (mode === 'Standard' && backgroundUrl) {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = backgroundUrl;
      img.onload = () => {
        bgImage.current = img;
      };
    } else {
      bgImage.current = null;
    }
  }, [mode, backgroundUrl]);

  useEffect(() => {
    // Meminta akses ke webcam
    let activeStream = null;
    navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
      .then((mediaStream) => {
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch((err) => {
        console.error("Gagal mengakses kamera:", err);
      });

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  // Video onPlay event -> Start Render Loop
  const handleVideoPlay = () => {
    if (mode === 'Standard') {
      if (!animationFrameId.current) {
        renderLoop();
      }
    }
  };

  const renderLoop = () => {
    if (!videoRef.current || !displayCanvasRef.current || !hiddenCanvasRef.current) return;
    
    const video = videoRef.current;
    const displayCanvas = displayCanvasRef.current;
    const hiddenCanvas = hiddenCanvasRef.current;
    const dCtx = displayCanvas.getContext('2d');
    const hCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });

    if (video.videoWidth === 0) {
      animationFrameId.current = requestAnimationFrame(renderLoop);
      return;
    }

    // Set ukuran canvas sama dengan video
    if (displayCanvas.width !== video.videoWidth) {
      displayCanvas.width = video.videoWidth;
      displayCanvas.height = video.videoHeight;
      hiddenCanvas.width = video.videoWidth;
      hiddenCanvas.height = video.videoHeight;
    }

    const w = video.videoWidth;
    const h = video.videoHeight;

    // Draw background first if available
    if (bgImage.current) {
      dCtx.drawImage(bgImage.current, 0, 0, w, h);
    } else {
      dCtx.clearRect(0, 0, w, h);
    }

    // Draw video to hidden canvas
    hCtx.drawImage(video, 0, 0, w, h);
    
    // Get frame data
    const frame = hCtx.getImageData(0, 0, w, h);
    const data = frame.data;
    const length = data.length;

    // Fast RGB threshold untuk preview hijau (daripada konversi HSV penuh yang berat)
    // Asumsi: Piksel hijau memiliki G lebih besar dari R dan B dengan margin tertentu.
    for (let i = 0; i < length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Simple Green Screen Threshold
      // Jika warna hijau lebih dominan dibanding merah dan biru
      if (g > r + 15 && g > b + 15) {
        data[i + 3] = 0; // Transparan
      }
    }

    // Tumpuk video (tanpa background) ke canvas display
    hCtx.putImageData(frame, 0, 0);
    dCtx.drawImage(hiddenCanvas, 0, 0, w, h);

    animationFrameId.current = requestAnimationFrame(renderLoop);
  };

  const startCountdownAndCapture = () => {
    if (countdown !== null) return;

    setCountdown(3);
    let counter = 3;

    const timer = setInterval(() => {
      counter--;
      setCountdown(counter);

      if (counter === 0) {
        clearInterval(timer);
        captureFrame();
        setTimeout(() => setCountdown(null), 500); 
      }
    }, 1000);
  };

  const captureFrame = () => {
    if (videoRef.current && hiddenCanvasRef.current) {
      const video = videoRef.current;
      const canvas = hiddenCanvasRef.current; // Gunakan hidden canvas untuk menangkap raw photo
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      // Draw RAW frame directly from video without mirroring
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Ambil Base64 (JPG kualitas tinggi)
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      onCapture(imageData);
    }
  };

  const handleCancel = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    onCancel();
  };

  return (
    <div className="relative w-full max-w-4xl aspect-video bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center">
      
      {/* Video disembunyikan jika mode Standar (menggunakan canvas preview), dimunculkan jika mode AI */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        onPlay={handleVideoPlay}
        className={`w-full h-full object-cover transform scale-x-[-1] ${mode === 'Standard' ? 'hidden' : 'block'}`} 
      />
      
      {/* Layar Canvas untuk Live Preview Green Screen */}
      <canvas 
        ref={displayCanvasRef} 
        className={`w-full h-full object-cover transform scale-x-[-1] ${mode === 'Standard' ? 'block' : 'hidden'}`} 
      />
      
      {/* Hidden Canvas untuk pemrosesan pixel & raw capture */}
      <canvas ref={hiddenCanvasRef} className="hidden" />

      {/* Tampilan Hitung Mundur */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm z-20 transition-all">
          <span className="text-[180px] font-extrabold text-white animate-pulse drop-shadow-2xl">
            {countdown > 0 ? countdown : ''}
          </span>
          {countdown === 0 && <CameraIcon size={120} className="text-white animate-pulse" />}
        </div>
      )}

      {/* Kontrol UI di atas Kamera */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-6 z-10">
        <button 
          onClick={handleCancel}
          className="w-14 h-14 flex items-center justify-center bg-slate-900/60 hover:bg-slate-800 text-slate-300 rounded-full shadow-lg transition-all backdrop-blur-md border border-slate-700/50"
          disabled={countdown !== null}
          title="Batal"
        >
          <X size={24} />
        </button>
        <button 
          onClick={startCountdownAndCapture}
          className="px-8 py-4 bg-slate-100 hover:bg-white text-slate-900 font-bold rounded-full shadow-xl transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-3"
          disabled={countdown !== null}
        >
          <CameraIcon size={24} /> Ambil Foto
        </button>
      </div>
    </div>
  );
}
