import React, { useState, useEffect, useMemo, useRef } from 'react';
import DomeGallery from './DomeGallery';
import { downloadPolaroid } from '../utils/polaroid';
import Galaxy from './Galaxy';
import Particles from './Particles';
import InfiniteGrid from './InfiniteGrid';

interface Photo {
  id: string;
  url: string;
  guestName: string;
  caption: string;
  likes?: number;
  comments?: { text: string; author: string; createdAt: string }[];
}

interface Props {
  initialPhotos: Photo[];
  isTotemMode?: boolean;
}

function getDomeProps() {
  if (typeof window === 'undefined') return { fit: 0.55, openedImageWidth: '480px', openedImageHeight: '480px' };
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isPortrait = h > w;
  const isMobile = w < 640;
  const isTablet = w >= 640 && w < 1024;
  const isTotem = isPortrait && w >= 500;

  if (isMobile) return { fit: 0.58, fitBasis: 'width' as const, openedImageWidth: `${Math.min(w - 32, 340)}px`, openedImageHeight: `${Math.min(w - 32, 340)}px` };
  if (isTotem) return { fit: 0.65, fitBasis: 'max' as const, openedImageWidth: '500px', openedImageHeight: '500px' };
  if (isTablet) return { fit: 0.50, openedImageWidth: '420px', openedImageHeight: '420px' };
  return { fit: 0.52, openedImageWidth: '480px', openedImageHeight: '480px' };
}

export default function GalleryIsland({ initialPhotos, isTotemMode = false }: Props) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [selectedGuest, setSelected] = useState<string | null>(null);
  const [domeProps, setDomeProps] = useState(getDomeProps);
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'dome' | 'grid'>('dome');
  const [commentText, setCommentText] = useState<{ [key: string]: string }>({});
  const [expandedComments, setExpandedComments] = useState<{ [key: string]: boolean }>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const onResize = () => setDomeProps(getDomeProps());
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/photos');
        const data = await res.json();
        setPhotos(data);
        const el = document.getElementById('count-num');
        if (el) el.textContent = data.length;
      } catch { }
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const guests = useMemo(() => {
    const seen = new Set<string>();
    return photos.reduce<string[]>((acc, p) => {
      if (p.guestName && !seen.has(p.guestName)) { seen.add(p.guestName); acc.push(p.guestName); }
      return acc;
    }, []);
  }, [photos]);

  const filtered = useMemo(() =>
    selectedGuest ? photos.filter(p => p.guestName === selectedGuest) : photos,
    [photos, selectedGuest]
  );

  const images = filtered.length > 0
    ? filtered.map(p => ({
      id: p.id,
      likes: p.likes || 0,
      comments: p.comments || [],
      src: p.url,
      alt: `Foto de ${p.guestName}`,
      caption: p.caption,
      guestName: p.guestName
    }))
    : undefined;

  const select = (name: string | null) => { setSelected(name); setOpen(false); };

  const handleLike = async (photoId: string) => {
    const likedKey = `astrogala_liked_${photoId}`;
    if (localStorage.getItem(likedKey)) return; // ya le dió like
    try {
      const res = await fetch(`/api/photos/${photoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like' })
      });
      if (res.ok) {
        const data = await res.json();
        setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, likes: data.likes } : p));
        localStorage.setItem(likedKey, '1');
      }
    } catch (e) { }
  };

  const handleComment = async (photoId: string) => {
    const text = commentText[photoId]?.trim();
    if (!text) return;
    const author = localStorage.getItem('astrogala_guest_name') || 'Invitado';
    try {
      const res = await fetch(`/api/photos/${photoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment', comment: { text, author } })
      });
      if (res.ok) {
        const updatedPhoto = await res.json();
        setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, comments: updatedPhoto.comments } : p));
        setCommentText(prev => ({ ...prev, [photoId]: '' })); // clear input
      }
    } catch (e) { }
  };

  return (
    <>
      <style>{`
        .feed-container {
          padding: 80px 20px 100px;
          overflow-y: auto;
          max-height: 100vh;
          width: 100%;
        }
        .feed-grid {
          display: grid;
          gap: 24px;
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          grid-template-columns: 1fr;
        }
        @media (min-width: 768px) {
          .feed-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1200px) {
          .feed-grid { grid-template-columns: repeat(3, 1fr); }
        }
        .feed-item {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 20px;
          backdrop-filter: blur(10px);
          transition: transform 0.3s ease;
          display: flex;
          flex-direction: column;
        }
        .feed-item:hover {
          transform: translateY(-5px);
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.15);
        }
      `}</style>
      {/* View & Background Toggle - Hidden in Totem Mode */}
      {!isTotemMode && (
        <div 
          id="view-toggle"
          style={{ 
            position: 'fixed', 
            bottom: '32px', 
            left: '32px', 
            zIndex: 70,
            transition: 'opacity 0.3s, transform 0.3s'
          }}
        >
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', padding: '4px', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <button onClick={() => setViewMode('dome')} style={{ padding: '8px 16px', borderRadius: '99px', border: 'none', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s', background: viewMode === 'dome' ? 'rgba(255,255,255,0.15)' : 'transparent', color: viewMode === 'dome' ? '#fff' : 'rgba(255,255,255,0.5)' }}>🌐 Domo</button>
            <button onClick={() => setViewMode('grid')} style={{ padding: '8px 16px', borderRadius: '99px', border: 'none', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s', background: viewMode === 'grid' ? 'rgba(255,255,255,0.15)' : 'transparent', color: viewMode === 'grid' ? '#fff' : 'rgba(255,255,255,0.5)' }}>📱 Feed</button>
          </div>
        </div>
      )}

      {/* Filter button — only when multiple guests and not in Totem Mode */}
      {!isTotemMode && guests.length > 1 && (
        <div 
          ref={dropdownRef} 
          id="person-filter"
          style={{ 
            position: 'fixed', 
            top: '84px', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            zIndex: 70,
            transition: 'opacity 0.3s, transform 0.3s'
          }}
        >

          {/* Trigger */}
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '7px 16px',
              borderRadius: '99px',
              border: `1px solid ${selectedGuest ? 'rgba(225,29,72,0.7)' : 'rgba(255,255,255,0.15)'}`,
              background: selectedGuest ? 'rgba(225,29,72,0.2)' : 'rgba(255,255,255,0.07)',
              backdropFilter: 'blur(16px)',
              color: selectedGuest ? '#fff' : 'rgba(255,255,255,0.55)',
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            <span>👥</span>
            <span>{selectedGuest ?? 'Ver por persona'}</span>
            {selectedGuest && (
              <span
                onClick={e => { e.stopPropagation(); select(null); }}
                style={{ marginLeft: '2px', opacity: 0.6, fontSize: '0.75rem', cursor: 'pointer' }}
              >✕</span>
            )}
          </button>

          {/* Dropdown */}
          {open && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              minWidth: '200px',
              maxWidth: '280px',
              background: 'rgba(13,6,24,0.92)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '8px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}>
              {/* All option */}
              <button
                onClick={() => select(null)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 12px', borderRadius: '10px', border: 'none',
                  background: !selectedGuest ? 'rgba(225,29,72,0.2)' : 'transparent',
                  color: !selectedGuest ? '#fff' : 'rgba(255,255,255,0.55)',
                  cursor: 'pointer', fontSize: '0.88rem', textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseOver={e => { if (selectedGuest) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseOut={e => { if (selectedGuest) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span>Todos</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{photos.length}</span>
              </button>

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />

              {/* Per-guest */}
              {guests.map(name => {
                const count = photos.filter(p => p.guestName === name).length;
                const active = selectedGuest === name;
                return (
                  <button
                    key={name}
                    onClick={() => select(name)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '9px 12px', borderRadius: '10px', border: 'none',
                      background: active ? 'rgba(225,29,72,0.2)' : 'transparent',
                      color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                      cursor: 'pointer', fontSize: '0.88rem', textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseOver={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseOut={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      {active && <span style={{ color: '#e11d48' }}>✓</span>}
                      {name}
                    </span>
                    <span style={{
                      background: active ? 'rgba(225,29,72,0.4)' : 'rgba(255,255,255,0.12)',
                      borderRadius: '99px', padding: '1px 8px', fontSize: '0.72rem',
                    }}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isTotemMode ? (
        <InfiniteGrid photos={photos} />
      ) : viewMode === 'dome' ? (
        <DomeGallery
          images={images}
          grayscale={false}
          overlayBlurColor="#0d0618"
          imageBorderRadius="14px"
          openedImageBorderRadius="18px"
          dragSensitivity={22}
          autoRotate={true}
          autoRotateSpeed={0.05}
          projection={isTotemMode ? 'cylinder' : 'sphere'}
          {...domeProps}
        />
      ) : (
        <div className="feed-container">
          <div className="feed-grid">
            {filtered.map(p => (
              <div key={p.id} className="feed-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingLeft: '4px' }}>
                <span style={{ fontSize: '1.2rem' }}>💌</span>
                <span style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1.2rem', fontWeight: 600, color: '#fff' }}>{p.guestName}</span>
              </div>

              <div style={{ borderRadius: '16px', overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.5)', aspectRatio: '1/1', position: 'relative' }}>
                {p.url.match(/\.(mp4|webm|mov)$/i) ? (
                  <video src={p.url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} autoPlay loop muted playsInline />
                ) : (
                  <img src={p.url} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'contain' }} loading="lazy" />
                )}
              </div>

              {p.caption && (
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem', lineHeight: 1.5, fontStyle: 'italic', fontFamily: 'Georgia, serif', borderLeft: '2px solid rgba(225,29,72,0.6)', paddingLeft: '12px', margin: '16px 0 0' }}>"{p.caption}"</p>
              )}

              <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px' }}>
                <button 
                  onClick={() => downloadPolaroid(p.url, p.guestName, p.caption)}
                  style={{
                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white', borderRadius: '99px', padding: '6px 14px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                  }}
                  onPointerDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.95)' }}
                  onPointerUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                  onPointerLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                >
                  <span>📥</span> <span>Compartir</span>
                </button>
                <button
                  onClick={() => handleLike(p.id)}
                  style={{
                    background: (typeof window !== 'undefined' && localStorage.getItem(`astrogala_liked_${p.id}`)) ? 'rgba(225,29,72,0.4)' : 'rgba(225,29,72,0.15)',
                    border: '1px solid rgba(225,29,72,0.3)',
                    color: 'white', borderRadius: '99px', padding: '6px 14px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                  }}
                  onPointerDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.95)' }}
                  onPointerUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                  onPointerLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                >
                  <span>❤️</span> <span>{p.likes || 0}</span>
                </button>
              </div>

              {/* Comments Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {p.comments && p.comments.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {p.comments.length > 2 && !expandedComments[p.id] && (
                      <button 
                        onClick={() => setExpandedComments(prev => ({ ...prev, [p.id]: true }))}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                      >
                        Ver los {p.comments.length} comentarios
                      </button>
                    )}
                    {(expandedComments[p.id] ? p.comments : p.comments.slice(-2)).map((c, i) => (
                      <div key={i} style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>
                        <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>{c.author}:</span> {c.text}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="text"
                    placeholder="Escribe un comentario..."
                    value={commentText[p.id] || ''}
                    onChange={e => setCommentText(prev => ({ ...prev, [p.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleComment(p.id); }}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: 'white', fontSize: '0.85rem', outline: 'none' }}
                  />
                  <button
                    onClick={() => handleComment(p.id)}
                    style={{ background: 'rgba(225,29,72,0.8)', border: 'none', padding: '0 14px', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Enviar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.5)', marginTop: '40px' }}>No hay fotos todavía.</div>
          )}
        </div>
      </div>
      )}
    </>
  );
}
