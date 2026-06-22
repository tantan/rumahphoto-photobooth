import { useState, useEffect } from 'react'
import Camera from './components/Camera'
import AdminPanel from './components/AdminPanel'
import QRCode from 'react-qr-code'
import { Settings, Camera as CameraIcon, Wand2, RefreshCw, CheckCircle2, ChevronRight } from 'lucide-react'

function App() {
  const [mode, setMode] = useState(null)
  const [photoData, setPhotoData] = useState(null)

  // State untuk melacak proses loading backend
  const [isProcessing, setIsProcessing] = useState(false)
  const [finalImage, setFinalImage] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState(null)

  // State untuk Admin Panel
  const [showAdmin, setShowAdmin] = useState(false)
  const [selectedPrompt, setSelectedPrompt] = useState('')
  const [aiTemplates, setAiTemplates] = useState([])

  // State untuk Green Screen Backgrounds
  const [availableBgs, setAvailableBgs] = useState([])
  const [selectedBg, setSelectedBg] = useState('')

  // State untuk pengaturan Chroma Key
  const [hsvLower, setHsvLower] = useState([35, 43, 46])
  const [hsvUpper, setHsvUpper] = useState([85, 255, 255])

  // Load template dan background saat pertama kali atau setelah admin panel ditutup
  useEffect(() => {
    if (!showAdmin) {
      const savedTemplates = JSON.parse(localStorage.getItem('pb_aiTemplates') || '[]');
      setAiTemplates(savedTemplates);
      if (savedTemplates.length > 0) {
        setSelectedPrompt(savedTemplates[0].prompt);
      }

      const savedLower = JSON.parse(localStorage.getItem('pb_hsvLower') || '[35, 43, 46]');
      const savedUpper = JSON.parse(localStorage.getItem('pb_hsvUpper') || '[85, 255, 255]');
      setHsvLower(savedLower);
      setHsvUpper(savedUpper);

      // Ambil daftar background dari server
      fetch('http://localhost:8000/backgrounds')
        .then(res => res.json())
        .then(data => {
          setAvailableBgs(data.backgrounds || []);
          if (data.backgrounds && data.backgrounds.length > 0) {
            setSelectedBg(data.backgrounds[0].filename);
          }
        })
        .catch(err => console.error("Gagal load backgrounds", err));
    }
  }, [showAdmin]);

  const handleCapture = (imageData) => {
    setPhotoData(imageData)
  }

  const handleRetake = () => {
    setPhotoData(null)
    setFinalImage(null)
  }

  const handleProcess = async () => {
    setIsProcessing(true)

    try {
      const response = await fetch('http://localhost:8000/process-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_base64: photoData,
          mode: mode,
          prompt: mode === 'AI' ? selectedPrompt : '',
          background_filename: mode === 'Standard' ? selectedBg : '',
          hsv_lower: hsvLower,
          hsv_upper: hsvUpper
        })
      });

      const data = await response.json();

      if (response.ok && data.status === "success") {
        setFinalImage(data.processed_image_base64);
        if (data.download_url) setDownloadUrl(data.download_url);
      } else {
        alert("Gagal memproses gambar: " + (data.detail || "Error backend"));
      }
    } catch (error) {
      console.error(error);
      alert("Tidak dapat terhubung ke Backend (pastikan server uvicorn menyala).");
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFinish = () => {
    // Reset kembali ke layar awal
    setMode(null)
    setPhotoData(null)
    setFinalImage(null)
    setDownloadUrl(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans p-6 relative overflow-hidden">

      {/* Subtle Background Pattern/Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 -z-10"></div>

      {/* Tombol Rahasia Admin (Pojok Kiri Atas) */}
      <button
        onClick={() => setShowAdmin(true)}
        className="absolute top-6 left-6 p-3 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-all rounded-full"
        title="Buka Admin Panel"
      >
        <Settings size={24} />
      </button>

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      <header className="mb-10 text-center z-10 pt-8">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3 tracking-tight">
          Rumah Photo Photobooth
        </h1>
        <p className="text-slate-400 text-lg font-medium">
          {mode === null ? "Pilih mode foto Anda untuk memulai" : `Mode Terpilih: ${mode}`}
        </p>
      </header>

      {/* 1. Tampilan Pemilihan Mode */}
      {mode === null && (
        <div className="flex flex-col md:flex-row gap-6 mt-4 w-full max-w-3xl px-4 z-10">
          <button
            onClick={() => setMode('Standard')}
            className="flex-1 p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 transition-all duration-300 flex flex-col items-center gap-5 group shadow-lg"
          >
            <div className="p-4 bg-slate-800/80 rounded-2xl group-hover:bg-slate-700/80 transition-colors shadow-inner">
              <CameraIcon size={32} className="text-slate-300 group-hover:text-white" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-slate-100 mb-2">Mode Standar</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Pilih latar belakang keren menggunakan teknologi Green Screen instan.</p>
            </div>
          </button>

          <button
            onClick={() => setMode('AI')}
            className="flex-1 p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 transition-all duration-300 flex flex-col items-center gap-5 group shadow-lg"
          >
            <div className="p-4 bg-slate-800/80 rounded-2xl group-hover:bg-slate-700/80 transition-colors shadow-inner">
              <Wand2 size={32} className="text-slate-300 group-hover:text-white" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-slate-100 mb-2">Mode AI</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Ubah wajah dan gaya Anda dengan kecerdasan buatan dari Cloud.</p>
            </div>
          </button>
        </div>
      )}

      {/* Pilihan Template AI (Hanya muncul saat Mode AI diplih sebelum ambil foto) */}
      {mode === 'AI' && photoData === null && aiTemplates.length > 0 && (
        <div className="mb-6 flex flex-col items-center animate-in fade-in z-10">
          <p className="text-sm text-slate-400 mb-3 font-semibold uppercase tracking-wider">Tema Tersedia</p>
          <div className="flex gap-3 flex-wrap justify-center">
            {aiTemplates.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => setSelectedPrompt(tpl.prompt)}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${selectedPrompt === tpl.prompt ? 'bg-slate-200 text-slate-900 shadow-sm' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'}`}
              >
                {tpl.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pilihan Background Green Screen (Hanya muncul saat Mode Standar) */}
      {mode === 'Standard' && photoData === null && availableBgs.length > 0 && (
        <div className="mb-6 flex flex-col items-center animate-in fade-in z-10">
          <p className="text-sm text-slate-400 mb-3 font-semibold uppercase tracking-wider">Latar Belakang</p>
          <div className="flex gap-4 flex-wrap justify-center max-w-2xl bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
            {availableBgs.map(bg => (
              <button
                key={bg.filename}
                onClick={() => setSelectedBg(bg.filename)}
                className={`relative rounded-lg overflow-hidden transition-all border-2 ${selectedBg === bg.filename ? 'border-slate-300 scale-[1.02] shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
              >
                <img src={bg.url} alt={bg.filename} className="w-24 h-16 object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. Tampilan Kamera */}
      {mode !== null && photoData === null && (
        <div className="w-full flex flex-col items-center animate-in fade-in duration-500 z-10">
          <Camera
            mode={mode}
            backgroundUrl={mode === 'Standard' ? availableBgs.find(b => b.filename === selectedBg)?.url : null}
            onCapture={handleCapture}
            onCancel={() => setMode(null)}
          />
        </div>
      )}

      {/* 3. Tampilan Preview Hasil Foto & Loading */}
      {photoData !== null && finalImage === null && (
        <div className="w-full max-w-4xl flex flex-col items-center animate-in fade-in duration-500 z-10">
          <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-800 mb-8 relative bg-slate-900">
            <img src={photoData} alt="Hasil Foto" className={`w-full h-auto object-cover ${isProcessing ? 'blur-md opacity-40' : ''}`} />

            {/* Animasi Loading Spinner di Atas Gambar */}
            {isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <RefreshCw size={48} className="text-slate-300 animate-spin mb-4" />
                <p className="text-lg font-semibold text-slate-200">
                  Memproses gambar...
                </p>
              </div>
            )}
          </div>

          {!isProcessing && (
            <div className="flex gap-4">
              <button
                onClick={handleRetake}
                className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium rounded-2xl shadow-sm transition-colors border border-slate-800 flex items-center gap-2"
              >
                <RefreshCw size={18} /> Ulangi
              </button>
              <button
                onClick={handleProcess}
                className="px-10 py-4 bg-slate-100 hover:bg-white text-slate-900 font-bold rounded-2xl shadow-md transition-transform hover:scale-105 flex items-center gap-2"
              >
                <Wand2 size={20} /> Proses Foto
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. Tampilan Hasil Akhir Setelah Diproses Backend */}
      {finalImage !== null && (
        <div className="w-full max-w-5xl flex flex-col items-center animate-in zoom-in duration-500 z-10">
          <div className="flex flex-col md:flex-row gap-6 w-full items-center md:items-stretch justify-center">
            {/* Bagian Foto */}
            <div className="w-full md:w-2/3 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 relative bg-slate-900 flex-shrink-0">
              <img src={finalImage} alt="Final Result" className="w-full h-auto object-cover" />
              <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 border border-slate-800 shadow-sm text-slate-200">
                <CheckCircle2 size={16} className="text-emerald-400" /> Selesai
              </div>
            </div>

            {/* Bagian QR Code */}
            {downloadUrl && (
              <div className="w-full md:w-1/3 bg-slate-900 p-8 rounded-3xl shadow-xl flex flex-col items-center justify-center border border-slate-800">
                <h3 className="text-xl font-bold text-slate-100 mb-2 text-center">Unduh Foto</h3>
                <p className="text-sm text-slate-400 text-center mb-8">Scan QR ini dengan HP Anda untuk mengunduh gambar ke galeri.</p>
                <div className="bg-white p-4 rounded-2xl mb-8 shadow-sm">
                  <QRCode value={downloadUrl} size={160} className="w-full h-auto" />
                </div>
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl transition-colors text-center border border-slate-700 flex items-center justify-center gap-2"
                >
                  Buka Link <ChevronRight size={16} />
                </a>
              </div>
            )}
          </div>

          <div className="flex gap-6 mt-10">
            <button
              onClick={handleFinish}
              className="px-10 py-4 bg-slate-100 hover:bg-white text-slate-900 font-bold text-lg rounded-2xl shadow-lg transition-transform hover:-translate-y-1"
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
