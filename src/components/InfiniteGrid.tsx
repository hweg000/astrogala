import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useGesture } from '@use-gesture/react';

interface Photo {
  id: string;
  url: string;
  guestName: string;
  caption: string;
}

interface InfiniteGridProps {
  photos: Photo[];
  autoScrollSpeed?: { x: number; y: number };
}

export default function InfiniteGrid({ photos, autoScrollSpeed = { x: 0.3, y: 0.2 } }: InfiniteGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
  
  // Create a safe pool of photos to repeat
  const pool = useMemo(() => {
    if (photos.length === 0) return [];
    // Ensure we have at least 20 items to fill a decent grid
    let result = [...photos];
    while (result.length < 24) result = [...result, ...photos];
    return result;
  }, [photos]);

  const COL_COUNT = 4;
  const TILE_WIDTH = 300;
  const TILE_HEIGHT = 400;
  const GAP = 20;

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      setGridSize({
        width: COL_COUNT * (TILE_WIDTH + GAP),
        height: Math.ceil(pool.length / COL_COUNT) * (TILE_HEIGHT + GAP)
      });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [pool]);

  const bind = useGesture({
    onDrag: ({ delta: [dx, dy] }) => {
      pos.current.x += dx;
      pos.current.y += dy;
    }
  });

  useEffect(() => {
    let animationId: number;
    const tick = () => {
      if (gridSize.width > 0 && gridSize.height > 0) {
        // Auto-scroll
        pos.current.x -= autoScrollSpeed.x;
        pos.current.y -= autoScrollSpeed.y;

        // Wrap logic
        if (Math.abs(pos.current.x) > gridSize.width) pos.current.x %= gridSize.width;
        if (Math.abs(pos.current.y) > gridSize.height) pos.current.y %= gridSize.height;

        if (containerRef.current) {
          containerRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
        }
      }
      animationId = requestAnimationFrame(tick);
    };
    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [gridSize, autoScrollSpeed]);

  if (pool.length === 0) return null;

  // We render a 3x3 block of the same grid to ensure seamless wrapping
  const renderGridBlock = (offsetX: number, offsetY: number) => (
    <div 
      key={`${offsetX}-${offsetY}`}
      style={{
        position: 'absolute',
        top: offsetY,
        left: offsetX,
        display: 'grid',
        gridTemplateColumns: `repeat(${COL_COUNT}, ${TILE_WIDTH}px)`,
        gap: `${GAP}px`,
        width: gridSize.width,
        height: gridSize.height,
      }}
    >
      {pool.map((p, i) => (
        <div 
          key={`${p.id}-${i}`}
          style={{
            width: TILE_WIDTH,
            height: TILE_HEIGHT,
            position: 'relative',
            borderRadius: '16px',
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.05)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {p.url.match(/\.(mp4|webm|mov)$/i) ? (
            <video 
              src={p.url} 
              autoPlay 
              muted 
              loop 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          ) : (
            <img 
              src={p.url} 
              alt={p.caption} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          )}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '20px 15px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
            color: 'white', fontSize: '0.85rem'
          }}>
            <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: '2px' }}>{p.guestName}</strong>
            <span style={{ opacity: 0.8 }}>{p.caption}</span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div 
      {...bind()} 
      style={{ 
        width: '100vw', 
        height: '100vh', 
        overflow: 'hidden', 
        position: 'relative', 
        background: '#0d0618',
        cursor: 'grab',
        touchAction: 'none'
      }}
    >
      <div 
        ref={containerRef}
        style={{ position: 'absolute', top: 0, left: 0, willChange: 'transform' }}
      >
        {/* Render a 3x3 grid tiling to allow infinite scrolling in any direction */}
        {[-1, 0, 1].map(ix => 
          [-1, 0, 1].map(iy => 
            renderGridBlock(ix * gridSize.width, iy * gridSize.height)
          )
        )}
      </div>
    </div>
  );
}
