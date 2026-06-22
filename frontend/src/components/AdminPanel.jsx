import { useState, useEffect, useRef } from 'react';
import { Settings, Key, Printer, Wand2, Image as ImageIcon, Palette, Save, X, Trash2, Plus } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export default function AdminPanel({ onClose }) {
  const [paperSize, setPaperSize] = useState('4R');
  const [apiKey, setApiKey] = useState('');
  const [templates, setTemplates] = useState([]);
  
  const [backgrounds, setBackgrounds] = useState([]);
  
  const [hsvLower, setHsvLower] = useState([35, 43, 46]);
  const [hsvUpper, setHsvUpper] = useState([85, 255, 255]);
  
  const [sampleImageSrc, setSampleImageSrc] = useState(null);
  const canvasRef = useRef(null);

  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplatePrompt, setNewTemplatePrompt] = useState('');

  useEffect(() => {
    // Load from LocalStorage
    const savedPaper = localStorage.getItem('pb_paperSize') || '4R';
    const savedKey = localStorage.getItem('pb_apiKey') || '';
    const savedTemplates = JSON.parse(localStorage.getItem('pb_aiTemplates') || '[]');
    const savedLower = JSON.parse(localStorage.getItem('pb_hsvLower') || '[35, 43, 46]');
    const savedUpper = JSON.parse(localStorage.getItem('pb_hsvUpper') || '[85, 255, 255]');

    if (savedTemplates.length === 0) {
      // Default template
      const defaultTpl = [{ id: 1, name: 'Cyberpunk', prompt: 'Make the subject look like a retro 80s cyberpunk character' }];
      setTemplates(defaultTpl);
      localStorage.setItem('pb_aiTemplates', JSON.stringify(defaultTpl));
    } else {
      setTemplates(savedTemplates);
    }

    setPaperSize(savedPaper);
    setApiKey(savedKey);
    setHsvLower(savedLower);
    setHsvUpper(savedUpper);
  }, []);

  const handleSave = () => {
    localStorage.setItem('pb_paperSize', paperSize);
    localStorage.setItem('pb_apiKey', apiKey);
    localStorage.setItem('pb_aiTemplates', JSON.stringify(templates));
    localStorage.setItem('pb_hsvLower', JSON.stringify(hsvLower));
    localStorage.setItem('pb_hsvUpper', JSON.stringify(hsvUpper));
    alert('Pengaturan berhasil disimpan!');
    onClose();
  };

  const handleAddTemplate = () => {
    if (!newTemplateName || !newTemplatePrompt) return;
    const newTpl = {
      id: Date.now(),
      name: newTemplateName,
      prompt: newTemplatePrompt
    };
    setTemplates([...templates, newTpl]);
    setNewTemplateName('');
    setNewTemplatePrompt('');
  };

  const handleDeleteTemplate = (id) => {
    setTemplates(templates.filter(t => t.id !== id));
  };

  // --- BACKGROUND UPLOAD LOGIC ---
  useEffect(() => {
    fetch(`${BACKEND_URL}/backgrounds`)
      .then(res => res.json())
      .then(data => setBackgrounds(data.backgrounds || []))
      .catch(err => console.error(err));
  }, []);

  const handleUploadBg = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${BACKEND_URL}/upload-background`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setBackgrounds([...backgrounds, { filename: data.filename, url: data.url }]);
    } catch (err) {
      alert("Gagal upload background. Pastikan backend menyala.");
    }
  };

  const handleDeleteBg = async (filename) => {
    try {
      await fetch(`${BACKEND_URL}/backgrounds/${filename}`, { method: 'DELETE' });
      setBackgrounds(backgrounds.filter(bg => bg.filename !== filename));
    } catch (err) {
      alert("Gagal menghapus background.");
    }
  };

  const handleSampleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setSampleImageSrc(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (sampleImageSrc && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        const maxWidth = 500;
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = sampleImageSrc;
    }
  }, [sampleImageSrc]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    
    // Convert RGB to OpenCV HSV
    let r = pixel[0] / 255;
    let g = pixel[1] / 255;
    let b = pixel[2] / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let d = max - min;
    let h = 0, s = (max === 0 ? 0 : d / max), v = max;

    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    let hcv = Math.round(h * 179);
    let scv = Math.round(s * 255);
    let vcv = Math.round(v * 255);

    // Auto set bounds (Margin +/-)
    setHsvLower([
      Math.max(0, hcv - 15),
      Math.max(0, scv - 50),
      Math.max(0, vcv - 50)
    ]);
    setHsvUpper([
      Math.min(179, hcv + 15),
      Math.min(255, scv + 50),
      Math.min(255, vcv + 50)
    ]);
  };

  return (
    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 overflow-y-auto p-4 md:p-8 font-sans flex justify-center">
      <div className="w-full max-w-3xl bg-slate-900 rounded-3xl shadow-2xl p-8 border border-slate-800 my-auto">
        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
          <h2 className="text-3xl font-extrabold text-slate-100 flex items-center gap-3">
            <Settings className="text-slate-400" size={32} /> Pengaturan
          </h2>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-full transition-colors">
            <X size={28} />
          </button>
        </div>

        {/* --- CLOUD API KEY --- */}
        <div className="mb-10">
          <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-slate-200">
            <Key size={20} className="text-slate-400" /> Cloud API Key
          </h3>
          <p className="text-sm text-slate-500 mb-4">Masukkan API Key Hugging Face untuk fitur Mode AI.</p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-slate-200 focus:outline-none focus:border-slate-500 transition-colors placeholder:text-slate-700"
            placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxx"
          />
        </div>

        {/* --- PAPER SIZE --- */}
        <div className="mb-10">
          <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-slate-200">
            <Printer size={20} className="text-slate-400" /> Ukuran Cetak
          </h3>
          <select
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-slate-200 focus:outline-none focus:border-slate-500 transition-colors"
          >
            <option value="4R">4R (10x15 cm)</option>
            <option value="Strip">Photo Strip (2x6 inch)</option>
            <option value="Square">Square (Instagram)</option>
          </select>
        </div>

        {/* --- TEMPLATE AI --- */}
        <div className="mb-10">
          <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-slate-200">
            <Wand2 size={20} className="text-slate-400" /> Template Tema AI
          </h3>
          <p className="text-sm text-slate-500 mb-4">Buat tema (*prompt*) yang dapat dipilih pelanggan.</p>

          <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800 mb-4">
            <input
              type="text"
              placeholder="Nama Tema (Misal: Superhero)"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mb-3 text-slate-200 focus:border-slate-500 transition-colors placeholder:text-slate-700"
            />
            <textarea
              placeholder="Prompt Instruksi AI (Misal: Transform this person into...)"
              value={newTemplatePrompt}
              onChange={e => setNewTemplatePrompt(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mb-3 text-slate-200 focus:border-slate-500 h-24 resize-none transition-colors placeholder:text-slate-700"
            />
            <button
              onClick={handleAddTemplate}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl transition-colors flex items-center gap-2"
            >
              <Plus size={18} /> Tambah Tema
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {templates.map(tpl => (
              <div key={tpl.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-start group">
                <div>
                  <h4 className="font-bold text-slate-200 mb-1">{tpl.name}</h4>
                  <p className="text-xs text-slate-500 italic line-clamp-2">"{tpl.prompt}"</p>
                </div>
                <button
                  onClick={() => handleDeleteTemplate(tpl.id)}
                  className="text-slate-600 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all"
                  title="Hapus"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* --- GREEN SCREEN BG --- */}
        <div className="mb-10">
          <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-slate-200">
            <ImageIcon size={20} className="text-slate-400" /> Latar Belakang Standar
          </h3>
          <p className="text-sm text-slate-500 mb-4">Gambar pengganti *Green Screen* (JPG/PNG).</p>

          <input
            type="file"
            accept="image/*"
            onChange={handleUploadBg}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 mb-6 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700 transition-all"
          />

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
            {backgrounds.map(bg => (
              <div key={bg.filename} className="relative group rounded-xl overflow-hidden border border-slate-800 aspect-[4/3]">
                <img src={bg.url} alt={bg.filename} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <button
                    onClick={() => handleDeleteBg(bg.filename)}
                    className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-colors backdrop-blur-sm"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {backgrounds.length === 0 && <p className="text-slate-600 text-sm col-span-3">Belum ada background yang diunggah.</p>}
          </div>
        </div>

        {/* --- CHROMA KEY SETTINGS --- */}
        <div className="mb-10">
          <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-slate-200">
            <Palette size={20} className="text-slate-400" /> Kalibrasi Warna Hijau
          </h3>
          <p className="text-sm text-slate-500 mb-6">Deteksi otomatis atau atur manual sensitivitas *Green Screen*.</p>
          
          {/* Color Picker dari Foto */}
          <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 mb-6 flex flex-col items-center">
             <input 
               type="file" 
               accept="image/*" 
               onChange={handleSampleUpload} 
               className="mb-4 text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700 transition-all" 
             />
             {sampleImageSrc && (
                <div className="relative w-full max-w-[500px]">
                  <p className="text-xs text-center text-slate-500 mb-3">Klik area tembok/layar di gambar ini.</p>
                  <canvas 
                    ref={canvasRef} 
                    onClick={handleCanvasClick}
                    className="w-full border border-slate-700 cursor-crosshair rounded-xl shadow-inner"
                  ></canvas>
                </div>
             )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-950/30 p-6 rounded-2xl border border-slate-800">
            {/* Lower Bound */}
            <div>
              <h4 className="font-semibold text-slate-300 mb-4 pb-2 border-b border-slate-800">Batas Bawah</h4>
              
              <div className="mb-4">
                <label className="flex justify-between items-center text-xs text-slate-400 mb-2"><span>HUE</span> <input type="number" min="0" max="179" value={hsvLower[0]} onChange={e => setHsvLower([parseInt(e.target.value)||0, hsvLower[1], hsvLower[2]])} className="bg-slate-900 border border-slate-700 text-slate-200 w-16 text-center rounded-md p-1 focus:border-slate-500" /></label>
                <input type="range" min="0" max="179" value={hsvLower[0]} onChange={e => setHsvLower([parseInt(e.target.value), hsvLower[1], hsvLower[2]])} className="w-full accent-slate-400 h-1 bg-slate-800 rounded-full appearance-none outline-none" />
              </div>
              <div className="mb-4">
                <label className="flex justify-between items-center text-xs text-slate-400 mb-2"><span>SATURATION</span> <input type="number" min="0" max="255" value={hsvLower[1]} onChange={e => setHsvLower([hsvLower[0], parseInt(e.target.value)||0, hsvLower[2]])} className="bg-slate-900 border border-slate-700 text-slate-200 w-16 text-center rounded-md p-1 focus:border-slate-500" /></label>
                <input type="range" min="0" max="255" value={hsvLower[1]} onChange={e => setHsvLower([hsvLower[0], parseInt(e.target.value), hsvLower[2]])} className="w-full accent-slate-400 h-1 bg-slate-800 rounded-full appearance-none outline-none" />
              </div>
              <div className="mb-4">
                <label className="flex justify-between items-center text-xs text-slate-400 mb-2"><span>VALUE</span> <input type="number" min="0" max="255" value={hsvLower[2]} onChange={e => setHsvLower([hsvLower[0], hsvLower[1], parseInt(e.target.value)||0])} className="bg-slate-900 border border-slate-700 text-slate-200 w-16 text-center rounded-md p-1 focus:border-slate-500" /></label>
                <input type="range" min="0" max="255" value={hsvLower[2]} onChange={e => setHsvLower([hsvLower[0], hsvLower[1], parseInt(e.target.value)])} className="w-full accent-slate-400 h-1 bg-slate-800 rounded-full appearance-none outline-none" />
              </div>
            </div>

            {/* Upper Bound */}
            <div>
              <h4 className="font-semibold text-slate-300 mb-4 pb-2 border-b border-slate-800">Batas Atas</h4>
              
              <div className="mb-4">
                <label className="flex justify-between items-center text-xs text-slate-400 mb-2"><span>HUE</span> <input type="number" min="0" max="179" value={hsvUpper[0]} onChange={e => setHsvUpper([parseInt(e.target.value)||0, hsvUpper[1], hsvUpper[2]])} className="bg-slate-900 border border-slate-700 text-slate-200 w-16 text-center rounded-md p-1 focus:border-slate-500" /></label>
                <input type="range" min="0" max="179" value={hsvUpper[0]} onChange={e => setHsvUpper([parseInt(e.target.value), hsvUpper[1], hsvUpper[2]])} className="w-full accent-slate-400 h-1 bg-slate-800 rounded-full appearance-none outline-none" />
              </div>
              <div className="mb-4">
                <label className="flex justify-between items-center text-xs text-slate-400 mb-2"><span>SATURATION</span> <input type="number" min="0" max="255" value={hsvUpper[1]} onChange={e => setHsvUpper([hsvUpper[0], parseInt(e.target.value)||0, hsvUpper[2]])} className="bg-slate-900 border border-slate-700 text-slate-200 w-16 text-center rounded-md p-1 focus:border-slate-500" /></label>
                <input type="range" min="0" max="255" value={hsvUpper[1]} onChange={e => setHsvUpper([hsvUpper[0], parseInt(e.target.value), hsvUpper[2]])} className="w-full accent-slate-400 h-1 bg-slate-800 rounded-full appearance-none outline-none" />
              </div>
              <div className="mb-4">
                <label className="flex justify-between items-center text-xs text-slate-400 mb-2"><span>VALUE</span> <input type="number" min="0" max="255" value={hsvUpper[2]} onChange={e => setHsvUpper([hsvUpper[0], hsvUpper[1], parseInt(e.target.value)||0])} className="bg-slate-900 border border-slate-700 text-slate-200 w-16 text-center rounded-md p-1 focus:border-slate-500" /></label>
                <input type="range" min="0" max="255" value={hsvUpper[2]} onChange={e => setHsvUpper([hsvUpper[0], hsvUpper[1], parseInt(e.target.value)])} className="w-full accent-slate-400 h-1 bg-slate-800 rounded-full appearance-none outline-none" />
              </div>
            </div>
          </div>
        </div>

        {/* --- ACTIONS --- */}
        <div className="flex justify-end gap-4 border-t border-slate-800 pt-8 mt-4">
          <button 
            onClick={onClose}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-colors"
          >
            Batal
          </button>
          <button 
            onClick={handleSave}
            className="px-8 py-3 bg-slate-200 hover:bg-white text-slate-900 font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            <Save size={18} /> Simpan Pengaturan
          </button>
        </div>
      </div>
    </div>
  );
}
