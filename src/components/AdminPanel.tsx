import { useState, useEffect } from 'react';

interface Photo {
  id: string;
  url: string;
  guestName: string;
  caption: string;
  likes?: number;
  uploadedAt: string;
}

export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPhotos = async () => {
    try {
      const res = await fetch('/api/photos');
      const data = await res.json();
      setPhotos(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (authenticated) fetchPhotos();
  }, [authenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '2026') {
      setAuthenticated(true);
    } else {
      alert('Contraseña incorrecta');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que quieres borrar esta foto?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/photos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer 2026' }
      });
      if (res.ok) {
        setPhotos(photos.filter(p => p.id !== id));
      } else {
        alert('Error al borrar');
      }
    } catch (e) {
      alert('Error de conexión');
    }
    setLoading(false);
  };

  if (!authenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <div className="bg-white/10 p-8 rounded-2xl border border-white/20 max-w-sm w-full backdrop-blur-xl">
          <div className="text-5xl mb-4">🛡️</div>
          <h1 className="text-2xl font-bold text-white mb-6">Administración</h1>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input 
              type="password" 
              placeholder="Contraseña" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center focus:outline-none focus:border-rose-400"
              autoFocus
            />
            <button 
              type="submit"
              className="bg-rose-500 hover:bg-rose-400 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Panel de Moderación</h1>
        <div className="text-white/50">{photos.length} fotos</div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {photos.map(photo => (
          <div key={photo.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden relative group">
            <div className="aspect-square bg-black/50">
              <img src={photo.url} className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="p-3">
              <div className="font-bold text-white text-sm truncate">{photo.guestName}</div>
              <div className="text-white/50 text-xs mt-1 truncate">{photo.caption || 'Sin dedicatoria'}</div>
              <div className="text-rose-400 text-xs mt-2">❤️ {photo.likes || 0}</div>
            </div>
            
            <button
              onClick={() => handleDelete(photo.id)}
              disabled={loading}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg disabled:opacity-50"
              title="Borrar foto"
            >
              🗑️
            </button>
          </div>
        ))}

        {photos.length === 0 && (
          <div className="col-span-full py-20 text-center text-white/40">
            No hay fotos subidas todavía.
          </div>
        )}
      </div>
    </div>
  );
}
