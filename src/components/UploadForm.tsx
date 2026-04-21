import { useState, useRef, useEffect, useCallback } from 'react';

const LS_KEY = 'astrogala_guest_name';

interface UploadFormProps {
  onSuccess?: () => void;
}

export default function UploadForm({ onSuccess }: UploadFormProps) {
  const [guestName, setGuestName]   = useState('');
  const [savedName, setSavedName]   = useState('');   // nombre en localStorage
  const [caption, setCaption]       = useState('');
  const [file, setFile]             = useState<File | null>(null);
  const [preview, setPreview]       = useState<string | null>(null);
  const [uploading, setUploading]   = useState(false);
  const [done, setDone]             = useState(false);
  const [error, setError]           = useState('');
  const [dragOver, setDragOver]     = useState(false);
  const [editingName, setEditingName] = useState(false);
  const inputRef   = useRef<HTMLInputElement>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);

  // Load saved name on mount
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY) || '';
    if (saved) {
      setSavedName(saved);
      setGuestName(saved);
    }
  }, []);

  const handleFile = (f: File) => {
    const isImage = f.type.startsWith('image/');
    const isVideo = f.type.startsWith('video/');
    
    if (!isImage && !isVideo) { 
      setError('Solo fotos o videos (JPG, PNG, MP4, MOV, WEBM)'); 
      return; 
    }
    
    if (f.size > 50 * 1024 * 1024) { 
      setError('El archivo es demasiado grande (máximo 50MB)'); 
      return; 
    }

    setError('');
    setFile(f);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !guestName.trim()) { setError('Nombre y foto son obligatorios'); return; }
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('guestName', guestName.trim());
      form.append('caption', caption.trim());
      const res  = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir');
      // Save name forever
      localStorage.setItem(LS_KEY, guestName.trim());
      setSavedName(guestName.trim());
      setDone(true);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Error al subir la foto');
    } finally {
      setUploading(false);
    }
  };

  const resetForAnother = () => {
    setDone(false);
    setFile(null);
    setPreview(null);
    setCaption('');
    // Keep guestName as-is
  };

  const forgetMe = () => {
    localStorage.removeItem(LS_KEY);
    setSavedName('');
    setGuestName('');
    setEditingName(false);
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12 text-center">
        <div className="text-7xl animate-bounce">💍</div>
        <h2 className="text-3xl font-bold text-white">¡Gracias, {guestName}!</h2>
        <p className="text-rose-200 text-lg">Tu foto ya está en la galería</p>
        <div className="flex gap-4 mt-4 flex-wrap justify-center">
          <a href="/" className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all">
            Ver galería 🎉
          </a>
          <button
            onClick={resetForAnother}
            className="px-6 py-3 rounded-full bg-rose-500 hover:bg-rose-400 text-white font-semibold transition-all"
          >
            Subir otra 📸
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full max-w-md mx-auto">

      {/* Welcome back banner */}
      {savedName && !editingName && (
        <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">👋</span>
            <span className="text-white font-medium">¡Hola de nuevo, <strong>{savedName}</strong>!</span>
          </div>
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="text-white/40 hover:text-white/80 text-xs underline transition-colors ml-3 shrink-0"
          >
            No soy yo
          </button>
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all
          ${dragOver ? 'border-rose-400 bg-rose-500/10' : 'border-white/20 hover:border-rose-400/50 hover:bg-white/5'}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {preview ? (
          <div className="relative">
            {file?.type.startsWith('video/') ? (
              <video 
                src={preview} 
                className="w-full max-h-64 object-cover rounded-xl" 
                controls 
                muted
              />
            ) : (
              <img src={preview} alt="Preview" className="w-full max-h-64 object-cover rounded-xl" />
            )}
            <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
              <span className="text-white font-medium">Cambiar archivo</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="text-5xl">📸</div>
            <p className="text-white font-semibold">Toca para seleccionar foto o video</p>
            <p className="text-white/40 text-sm">Biblioteca o cámara · max 50MB</p>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {/* Camera capture — mobile only */}
        <input ref={cameraRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" capture="environment" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {/* Camera button */}
      {!preview && (
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm font-medium transition-all"
        >
          <span className="text-lg">📷</span>
          Tomar foto o video
        </button>
      )}

      {/* Name — only show if no saved name OR editing */}
      {(!savedName || editingName) && (
        <div className="flex flex-col gap-2">
          <label className="text-white/70 text-sm font-medium">Tu nombre *</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="¿Cómo te llamas?"
              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-rose-400 transition-colors"
              required
              autoFocus={editingName}
            />
            {editingName && (
              <button type="button" onClick={forgetMe}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white/70 text-xs transition-colors">
                Borrar
              </button>
            )}
          </div>
          {editingName && (
            <p className="text-white/30 text-xs">Tu nombre se guardará para la próxima vez</p>
          )}
        </div>
      )}

      {/* Caption */}
      <div className="flex flex-col gap-2">
        <label className="text-white/70 text-sm font-medium">Dedicatoria (opcional)</label>
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="¡Felicidades a los novios! 🥂"
          rows={3}
          className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-rose-400 transition-colors resize-none"
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          ⚠️ {error}
        </p>
      )}

      <button
        type="submit"
        disabled={uploading || !file || !guestName.trim()}
        className="py-4 rounded-full font-bold text-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed
          bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400
          text-white shadow-lg shadow-rose-500/30 active:scale-95"
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Subiendo…
          </span>
        ) : '📤 Compartir foto'}
      </button>
    </form>
  );
}
