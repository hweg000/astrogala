import { useState, useEffect, useCallback } from 'react';

interface Comment {
  text: string;
  author: string;
  createdAt: string;
}

interface Photo {
  id: string;
  url: string;
  guestName: string;
  caption: string;
  likes?: number;
  comments?: Comment[];
  uploadedAt: string;
  approved?: boolean;
}

const isVideo = (url: string) => /\.(mp4|webm|mov)$/i.test(url);

const fmt = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return iso; }
};

// ── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <button onClick={onClose} style={{
        position: 'absolute', top: '16px', right: '16px',
        width: '40px', height: '40px', borderRadius: '50%',
        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
        color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'grid', placeItems: 'center',
      }}>✕</button>
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
        {isVideo(photo.url) ? (
          <video src={photo.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '12px' }} />
        ) : (
          <img src={photo.url} alt="" style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '12px', objectFit: 'contain' }} />
        )}
        <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '10px', padding: '10px 16px', color: 'white', fontSize: '0.9rem', textAlign: 'center' }}>
          <strong>{photo.guestName}</strong>{photo.caption ? ` — "${photo.caption}"` : ''}
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/photos', { headers: { 'Authorization': 'Bearer 2026' } });
      if (res.ok) {
        const data = await res.json();
        setPhotos(data);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (authenticated) fetchPhotos(); }, [authenticated, fetchPhotos]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '2026') setAuthenticated(true);
    else alert('Contraseña incorrecta');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que quieres borrar esta foto?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/photos/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer 2026' } });
      if (res.ok) setPhotos(prev => prev.filter(p => p.id !== id));
      else alert('Error al borrar');
    } catch { alert('Error de conexión'); }
    setDeleting(null);
  };

  // ── Login screen ───────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
        <div style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '24px', padding: '48px 36px', maxWidth: '360px', width: '100%',
          backdropFilter: 'blur(20px)', textAlign: 'center',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🛡️</div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'white', marginBottom: '28px' }}>Administración</h1>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px', padding: '14px 16px', color: 'white', fontSize: '1rem',
                outline: 'none', textAlign: 'center', width: '100%',
              }}
            />
            <button
              type="submit"
              style={{
                background: 'linear-gradient(135deg, #e11d48, #db2777)',
                border: 'none', color: 'white', fontWeight: 700,
                padding: '14px', borderRadius: '12px', fontSize: '1rem', cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onPointerEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onPointerLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Filtered list ──────────────────────────────────────────────────────────
  const displayed = photos.filter(p => {
    if (filter === 'approved') return p.approved !== false;
    if (filter === 'pending') return p.approved === false;
    return true;
  });

  const totalLikes = photos.reduce((s, p) => s + (p.likes || 0), 0);
  const totalComments = photos.reduce((s, p) => s + (p.comments?.length || 0), 0);

  // ── Admin panel ────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        .admin-grid {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(2, 1fr);
        }
        @media (min-width: 640px) { .admin-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 960px) { .admin-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (min-width: 1280px) { .admin-grid { grid-template-columns: repeat(5, 1fr); } }
        .stat-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .photo-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: border-color 0.2s;
        }
        .photo-card:hover { border-color: rgba(255,255,255,0.18); }
        .filter-btn {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 99px;
          color: rgba(255,255,255,0.5);
          padding: 6px 18px;
          font-size: 0.82rem;
          cursor: pointer;
          transition: all 0.18s;
        }
        .filter-btn.active {
          background: rgba(225,29,72,0.2);
          border-color: rgba(225,29,72,0.5);
          color: white;
        }
        .delete-btn {
          background: rgba(239,68,68,0.15);
          border: 1px solid rgba(239,68,68,0.3);
          color: #fca5a5;
          border-radius: 8px;
          padding: 6px;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.18s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .delete-btn:hover { background: rgba(239,68,68,0.35); border-color: rgba(239,68,68,0.6); color: white; }
        .delete-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '80px 20px 40px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'white', margin: 0 }}>Panel de Moderación</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', margin: '4px 0 0', fontSize: '0.9rem' }}>AstroGala — Galería de la Boda</p>
          </div>
          <button
            onClick={fetchPhotos}
            disabled={loading}
            style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px', color: 'white', padding: '10px 20px', cursor: 'pointer',
              fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px',
              opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s',
            }}
          >
            {loading ? '⏳' : '🔄'} {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '28px' }}>
          <div className="stat-card">
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'white' }}>{photos.length}</span>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>Fotos totales</span>
          </div>
          <div className="stat-card">
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'white' }}>{photos.filter(p => isVideo(p.url)).length}</span>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>Videos</span>
          </div>
          <div className="stat-card">
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f43f5e' }}>{totalLikes}</span>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>❤️ Likes totales</span>
          </div>
          <div className="stat-card">
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'white' }}>{totalComments}</span>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>💬 Comentarios</span>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {(['all', 'approved', 'pending'] as const).map(f => (
            <button
              key={f}
              className={`filter-btn${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? `Todas (${photos.length})` : f === 'approved' ? `Aprobadas (${photos.filter(p => p.approved !== false).length})` : `Ocultas (${photos.filter(p => p.approved === false).length})`}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading && photos.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '80px 0', fontSize: '1.1rem' }}>Cargando fotos...</div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '80px 0', fontSize: '1.1rem' }}>No hay fotos en esta categoría.</div>
        ) : (
          <div className="admin-grid">
            {displayed.map(photo => (
              <div key={photo.id} className="photo-card">
                {/* Thumbnail */}
                <div
                  onClick={() => setLightboxPhoto(photo)}
                  style={{ aspectRatio: '1/1', background: '#000', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                >
                  {isVideo(photo.url) ? (
                    <>
                      <video
                        src={`${photo.url}#t=0.001`}
                        preload="metadata"
                        muted playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.2)', pointerEvents: 'none' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', display: 'grid', placeItems: 'center' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                      </div>
                    </>
                  ) : (
                    <img src={photo.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  )}
                  {/* Badges */}
                  <div style={{ position: 'absolute', top: '6px', left: '6px', display: 'flex', gap: '4px' }}>
                    {isVideo(photo.url) && (
                      <span style={{ background: 'rgba(0,0,0,0.7)', borderRadius: '6px', padding: '2px 7px', fontSize: '0.7rem', color: 'white' }}>VIDEO</span>
                    )}
                    {photo.approved === false && (
                      <span style={{ background: 'rgba(239,68,68,0.8)', borderRadius: '6px', padding: '2px 7px', fontSize: '0.7rem', color: 'white' }}>OCULTA</span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'white', fontSize: '0.88rem', lineHeight: 1.3 }}>{photo.guestName || '—'}</div>
                      {photo.caption && (
                        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', marginTop: '2px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          "{photo.caption}"
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                    <span>❤️ {photo.likes || 0}</span>
                    {(photo.comments?.length ?? 0) > 0 && <span>💬 {photo.comments!.length}</span>}
                    <span style={{ marginLeft: 'auto' }}>{fmt(photo.uploadedAt)}</span>
                  </div>

                  {/* Delete */}
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(photo.id)}
                    disabled={deleting === photo.id}
                    style={{ marginTop: '4px', width: '100%' }}
                  >
                    {deleting === photo.id ? '⏳ Borrando...' : '🗑️ Borrar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {lightboxPhoto && <Lightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />}
    </>
  );
}
