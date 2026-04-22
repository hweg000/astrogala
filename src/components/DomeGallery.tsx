import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useGesture } from '@use-gesture/react';
import { downloadPolaroid } from '../utils/polaroid';

type ImageItem = string | { id?: string; likes?: number; src: string; alt?: string; caption?: string; guestName?: string; comments?: any[] };

type DomeGalleryProps = {
  images?: ImageItem[];
  fit?: number;
  fitBasis?: 'auto' | 'min' | 'max' | 'width' | 'height';
  minRadius?: number;
  maxRadius?: number;
  padFactor?: number;
  overlayBlurColor?: string;
  maxVerticalRotationDeg?: number;
  dragSensitivity?: number;
  enlargeTransitionMs?: number;
  segments?: number;
  dragDampening?: number;
  openedImageWidth?: string;
  openedImageHeight?: string;
  imageBorderRadius?: string;
  openedImageBorderRadius?: string;
  grayscale?: boolean;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  projection?: 'sphere' | 'cylinder';
};

type ItemDef = {
  id?: string;
  likes?: number;
  comments?: any[];
  src: string;
  alt: string;
  caption: string;
  guestName: string;
  x: number;
  y: number;
  sizeX: number;
  sizeY: number;
};

const DEFAULT_IMAGES: ImageItem[] = [
  { src: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800', alt: 'Wedding', guestName: 'Demo', caption: '¡Que vivan los novios!' },
  { src: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?w=800', alt: 'Couple', guestName: 'Demo', caption: 'Felicidades 🥂' },
  { src: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800', alt: 'Flowers', guestName: 'Demo', caption: 'Un día mágico 🌸' },
  { src: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800', alt: 'Rings', guestName: 'Demo', caption: 'Para siempre 💍' },
  { src: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800', alt: 'Ceremony', guestName: 'Demo', caption: 'Un momento único' },
  { src: 'https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=800', alt: 'Celebration', guestName: 'Demo', caption: '¡A celebrar! 🎉' },
  { src: 'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?w=800', alt: 'Dance', guestName: 'Demo', caption: 'Bailando toda la noche 💃' },
];

const DEFAULTS = {
  maxVerticalRotationDeg: 5,
  dragSensitivity: 20,
  enlargeTransitionMs: 300,
  segments: 35
};

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const normalizeAngle = (d: number) => ((d % 360) + 360) % 360;
const wrapAngleSigned = (deg: number) => {
  const a = (((deg + 180) % 360) + 360) % 360;
  return a - 180;
};
const getDataNumber = (el: HTMLElement, name: string, fallback: number) => {
  const attr = el.dataset[name] ?? el.getAttribute(`data-${name}`);
  const n = attr == null ? NaN : parseFloat(attr);
  return Number.isFinite(n) ? n : fallback;
};

function buildItems(pool: ImageItem[], seg: number): ItemDef[] {
  const xCols = Array.from({ length: seg }, (_, i) => -37 + i * 2);
  const evenYs = [-14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14];
  const oddYs = [-13, -11, -9, -7, -5, -3, -1, 1, 3, 5, 7, 9, 11, 13, 15];

  const coords = xCols.flatMap((x, c) => {
    const ys = c % 2 === 0 ? evenYs : oddYs;
    return ys.map(y => ({ x, y, sizeX: 2, sizeY: 2 }));
  });

  const totalSlots = coords.length;
  if (pool.length === 0) {
    return coords.map(c => ({ ...c, src: '', alt: '', caption: '', guestName: '' }));
  }

  const normalizedImages = pool.map(image => {
    if (typeof image === 'string') return { src: image, alt: '', caption: '', guestName: '' };
    return {
      id: image.id,
      likes: image.likes || 0,
      comments: image.comments || [],
      src: image.src || '',
      alt: image.alt || '',
      caption: image.caption || '',
      guestName: image.guestName || '',
    };
  });

  const usedImages = Array.from({ length: totalSlots }, (_, i) => normalizedImages[i % normalizedImages.length]);

  for (let i = 1; i < usedImages.length; i++) {
    if (usedImages[i].src === usedImages[i - 1].src) {
      for (let j = i + 1; j < usedImages.length; j++) {
        if (usedImages[j].src !== usedImages[i].src) {
          const tmp = usedImages[i];
          usedImages[i] = usedImages[j];
          usedImages[j] = tmp;
          break;
        }
      }
    }
  }

  return coords.map((c, i) => ({
    ...c,
    id: usedImages[i].id,
    likes: usedImages[i].likes,
    comments: usedImages[i].comments,
    src: usedImages[i].src,
    alt: usedImages[i].alt,
    caption: usedImages[i].caption,
    guestName: usedImages[i].guestName,
  }));
}

function computeItemBaseRotation(offsetX: number, offsetY: number, sizeX: number, sizeY: number, segments: number) {
  const unit = 360 / segments / 2;
  const rotateY = unit * (offsetX + (sizeX - 1) / 2);
  const rotateX = unit * 1.15 * (offsetY - (sizeY - 1) / 2); // Subtle stretch
  return { rotateX, rotateY };
}

export default function DomeGallery({
  images = DEFAULT_IMAGES,
  fit = 0.5,
  fitBasis = 'auto',
  minRadius = 600,
  maxRadius = Infinity,
  padFactor = 0.25,
  overlayBlurColor = '#1a0a2e',
  maxVerticalRotationDeg = DEFAULTS.maxVerticalRotationDeg,
  dragSensitivity = DEFAULTS.dragSensitivity,
  enlargeTransitionMs = DEFAULTS.enlargeTransitionMs,
  segments = DEFAULTS.segments,
  projection = 'sphere',
  dragDampening = 2,
  openedImageWidth = '480px',
  openedImageHeight = '480px',
  imageBorderRadius = '20px',
  openedImageBorderRadius = '20px',
  grayscale = false,
  autoRotate = false,
  autoRotateSpeed = 0.25,
}: DomeGalleryProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const sphereRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const focusedElRef = useRef<HTMLElement | null>(null);
  const originalTilePositionRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null);

  const rotationRef = useRef({ x: 0, y: 0 });
  const startRotRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const cancelTapRef = useRef(false);
  const movedRef = useRef(false);
  const inertiaRAF = useRef<number | null>(null);
  const pointerTypeRef = useRef<'mouse' | 'pen' | 'touch'>('mouse');
  const tapTargetRef = useRef<HTMLElement | null>(null);
  const openingRef = useRef(false);
  const openStartedAtRef = useRef(0);
  const lastDragEndAt = useRef(0);
  const lastInteractionRef = useRef(0);  // timestamp of last user interaction
  const autoRotateRAFRef = useRef<number | null>(null);

  const scrollLockedRef = useRef(false);
  const lockScroll = useCallback(() => {
    if (scrollLockedRef.current) return;
    scrollLockedRef.current = true;
    document.body.classList.add('dg-scroll-lock');
  }, []);
  const unlockScroll = useCallback(() => {
    if (!scrollLockedRef.current) return;
    if (rootRef.current?.getAttribute('data-enlarging') === 'true') return;
    scrollLockedRef.current = false;
    document.body.classList.remove('dg-scroll-lock');
  }, []);

  const items = useMemo(() => buildItems(images, segments), [images, segments]);

  const applyTransform = (xDeg: number, yDeg: number) => {
    const el = sphereRef.current;
    if (el) el.style.transform = `translateZ(calc(var(--radius) * -1)) rotateX(${xDeg}deg) rotateY(${yDeg}deg)`;
  };

  const lockedRadiusRef = useRef<number | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(entries => {
      const cr = entries[0].contentRect;
      const w = Math.max(1, cr.width), h = Math.max(1, cr.height);
      const minDim = Math.min(w, h), maxDim = Math.max(w, h), aspect = w / h;
      let basis: number;
      switch (fitBasis) {
        case 'min': basis = minDim; break;
        case 'max': basis = maxDim; break;
        case 'width': basis = w; break;
        case 'height': basis = h; break;
        default: basis = aspect >= 1.3 ? w : minDim;
      }
      let radius = basis * fit;
      radius = Math.min(radius, h * 1.35);
      radius = clamp(radius, minRadius, maxRadius);
      lockedRadiusRef.current = Math.round(radius);

      const viewerPad = Math.max(8, Math.round(minDim * padFactor));
      root.style.setProperty('--radius', `${lockedRadiusRef.current}px`);
      root.style.setProperty('--viewer-pad', `${viewerPad}px`);
      root.style.setProperty('--overlay-blur-color', overlayBlurColor);
      root.style.setProperty('--tile-radius', imageBorderRadius);
      root.style.setProperty('--enlarge-radius', openedImageBorderRadius);
      root.style.setProperty('--image-filter', grayscale ? 'grayscale(1)' : 'none');
      applyTransform(rotationRef.current.x, rotationRef.current.y);

      const enlargedOverlay = viewerRef.current?.querySelector('.enlarge') as HTMLElement;
      if (enlargedOverlay && frameRef.current && mainRef.current) {
        const frameR = frameRef.current.getBoundingClientRect();
        const mainR = mainRef.current.getBoundingClientRect();
        if (openedImageWidth && openedImageHeight) {
          const tempDiv = document.createElement('div');
          tempDiv.style.cssText = `position:absolute;width:${openedImageWidth};height:${openedImageHeight};visibility:hidden;`;
          document.body.appendChild(tempDiv);
          const tempRect = tempDiv.getBoundingClientRect();
          document.body.removeChild(tempDiv);
          enlargedOverlay.style.left = `${frameR.left - mainR.left + (frameR.width - tempRect.width) / 2}px`;
          enlargedOverlay.style.top = `${frameR.top - mainR.top + (frameR.height - tempRect.height) / 2}px`;
        } else {
          enlargedOverlay.style.left = `${frameR.left - mainR.left}px`;
          enlargedOverlay.style.top = `${frameR.top - mainR.top}px`;
          enlargedOverlay.style.width = `${frameR.width}px`;
          enlargedOverlay.style.height = `${frameR.height}px`;
        }
      }
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, [fit, fitBasis, minRadius, maxRadius, padFactor, overlayBlurColor, grayscale, imageBorderRadius, openedImageBorderRadius, openedImageWidth, openedImageHeight]);

  useEffect(() => {
    applyTransform(rotationRef.current.x, rotationRef.current.y);

    // Deep linking: check if URL has #photo-id
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#photo-')) {
        const id = hash.replace('#photo-', '');
        setTimeout(() => {
          const el = sphereRef.current?.querySelector(`[data-id="${id}"] .item__image`) as HTMLElement;
          if (el) openItemFromElement(el);
        }, 500); // Wait for items to be ready
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // ── Auto-rotation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoRotate) return;
    const RESUME_DELAY = 1500; // ms after last interaction before resuming
    let prevTime = 0;
    const step = (time: number) => {
      autoRotateRAFRef.current = requestAnimationFrame(step);
      const dt = prevTime ? Math.min(time - prevTime, 50) : 16; // cap at 50ms to avoid jump after tab switch
      prevTime = time;
      const isInteracting = draggingRef.current || inertiaRAF.current !== null || focusedElRef.current !== null;
      if (isInteracting || time - lastInteractionRef.current < RESUME_DELAY) return;
      const nextY = wrapAngleSigned(rotationRef.current.y + autoRotateSpeed * (dt / 16.67));
      rotationRef.current = { ...rotationRef.current, y: nextY };
      applyTransform(rotationRef.current.x, nextY);
    };
    autoRotateRAFRef.current = requestAnimationFrame(step);
    return () => { if (autoRotateRAFRef.current) cancelAnimationFrame(autoRotateRAFRef.current); };
  }, [autoRotate, autoRotateSpeed]);

  const stopInertia = useCallback(() => {
    if (inertiaRAF.current) { cancelAnimationFrame(inertiaRAF.current); inertiaRAF.current = null; }
  }, []);

  const startInertia = useCallback((vx: number, vy: number) => {
    const MAX_V = 1.4;
    let vX = clamp(vx, -MAX_V, MAX_V) * 80;
    let vY = clamp(vy, -MAX_V, MAX_V) * 80;
    let frames = 0;
    const d = clamp(dragDampening ?? 0.6, 0, 1);
    const frictionMul = 0.94 + 0.055 * d;
    const stopThreshold = 0.015 - 0.01 * d;
    const maxFrames = Math.round(90 + 270 * d);
    const step = () => {
      vX *= frictionMul; vY *= frictionMul;
      if (Math.abs(vX) < stopThreshold && Math.abs(vY) < stopThreshold) { inertiaRAF.current = null; return; }
      if (++frames > maxFrames) { inertiaRAF.current = null; return; }
      const nextX = clamp(rotationRef.current.x - vY / 200, -maxVerticalRotationDeg, maxVerticalRotationDeg);
      const nextY = wrapAngleSigned(rotationRef.current.y + vX / 200);
      rotationRef.current = { x: nextX, y: nextY };
      applyTransform(nextX, nextY);
      inertiaRAF.current = requestAnimationFrame(step);
    };
    stopInertia();
    inertiaRAF.current = requestAnimationFrame(step);
  }, [dragDampening, maxVerticalRotationDeg, stopInertia]);

  useGesture({
    onDragStart: ({ event }) => {
      if (focusedElRef.current) return;
      stopInertia();
      lastInteractionRef.current = performance.now(); // record interaction
      const evt = event as PointerEvent;
      pointerTypeRef.current = (evt.pointerType as any) || 'mouse';
      if (pointerTypeRef.current === 'touch') evt.preventDefault();
      if (pointerTypeRef.current === 'touch') lockScroll();
      draggingRef.current = true;
      cancelTapRef.current = false;
      movedRef.current = false;
      startRotRef.current = { ...rotationRef.current };
      startPosRef.current = { x: evt.clientX, y: evt.clientY };
      const potential = (evt.target as Element).closest?.('.item__image') as HTMLElement | null;
      tapTargetRef.current = potential || null;
    },
    onDrag: ({ event, last, velocity: velArr = [0, 0], direction: dirArr = [0, 0], movement }) => {
      if (focusedElRef.current || !draggingRef.current || !startPosRef.current) return;
      const evt = event as PointerEvent;
      if (pointerTypeRef.current === 'touch') evt.preventDefault();
      const dxTotal = evt.clientX - startPosRef.current.x;
      const dyTotal = evt.clientY - startPosRef.current.y;
      if (!movedRef.current) {
        if (dxTotal * dxTotal + dyTotal * dyTotal > 16) movedRef.current = true;
      }
      const nextX = clamp(startRotRef.current.x - dyTotal / dragSensitivity, -maxVerticalRotationDeg, maxVerticalRotationDeg);
      const nextY = startRotRef.current.y + dxTotal / dragSensitivity;
      const cur = rotationRef.current;
      if (cur.x !== nextX || cur.y !== nextY) {
        rotationRef.current = { x: nextX, y: nextY };
        applyTransform(nextX, nextY);
      }
      if (last) {
        draggingRef.current = false;
        let isTap = false;
        if (startPosRef.current) {
          const dx = evt.clientX - startPosRef.current.x;
          const dy = evt.clientY - startPosRef.current.y;
          const TAP_THRESH_PX = pointerTypeRef.current === 'touch' ? 10 : 6;
          if (dx * dx + dy * dy <= TAP_THRESH_PX * TAP_THRESH_PX) isTap = true;
        }
        let [vMagX, vMagY] = velArr;
        const [dirX, dirY] = dirArr;
        let vx = vMagX * dirX, vy = vMagY * dirY;
        if (!isTap && Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001 && Array.isArray(movement)) {
          const [mx, my] = movement;
          vx = (mx / dragSensitivity) * 0.02;
          vy = (my / dragSensitivity) * 0.02;
        }
        if (!isTap && (Math.abs(vx) > 0.005 || Math.abs(vy) > 0.005)) startInertia(vx, vy);
        startPosRef.current = null;
        cancelTapRef.current = !isTap;
        if (isTap && tapTargetRef.current && !focusedElRef.current) openItemFromElement(tapTargetRef.current);
        tapTargetRef.current = null;
        if (cancelTapRef.current) setTimeout(() => (cancelTapRef.current = false), 120);
        if (pointerTypeRef.current === 'touch') unlockScroll();
        if (movedRef.current) lastDragEndAt.current = performance.now();
        lastInteractionRef.current = performance.now(); // reset auto-rotate timer
        movedRef.current = false;
      }
    }
  }, { target: mainRef, eventOptions: { passive: false } });

  // ─── Remove caption card helper ───────────────────────────────────────────
  const removeCaptionCard = () => {
    const card = viewerRef.current?.querySelector('.caption-card') as HTMLElement | null;
    if (!card) return;
    card.style.opacity = '0';
    card.style.transform = 'translateX(-50%) translateY(16px)';
    setTimeout(() => card.remove(), 350);
  };

  useEffect(() => {
    const scrim = scrimRef.current;
    if (!scrim) return;
    const close = () => {
      if (performance.now() - openStartedAtRef.current < 250) return;
      const el = focusedElRef.current;
      if (!el) return;
      const parent = el.parentElement as HTMLElement;
      const overlay = viewerRef.current?.querySelector('.enlarge') as HTMLElement | null;
      if (!overlay) return;
      const refDiv = parent.querySelector('.item__image--reference') as HTMLElement | null;
      const originalPos = originalTilePositionRef.current;

      // Fade out caption card immediately
      removeCaptionCard();

      if (!originalPos) {
        overlay.remove();
        if (refDiv) refDiv.remove();
        parent.style.setProperty('--rot-y-delta', '0deg');
        parent.style.setProperty('--rot-x-delta', '0deg');
        el.style.visibility = '';
        (el.style as any).zIndex = 0;
        focusedElRef.current = null;
        rootRef.current?.removeAttribute('data-enlarging');
        openingRef.current = false;
        return;
      }

      const currentRect = overlay.getBoundingClientRect();
      const rootRect = rootRef.current!.getBoundingClientRect();
      const originalPosRelativeToRoot = {
        left: originalPos.left - rootRect.left, top: originalPos.top - rootRect.top,
        width: originalPos.width, height: originalPos.height,
      };
      const overlayRelativeToRoot = {
        left: currentRect.left - rootRect.left, top: currentRect.top - rootRect.top,
        width: currentRect.width, height: currentRect.height,
      };
      const animatingOverlay = document.createElement('div');
      animatingOverlay.className = 'enlarge-closing';
      animatingOverlay.style.cssText = `position:absolute;left:${overlayRelativeToRoot.left}px;top:${overlayRelativeToRoot.top}px;width:${overlayRelativeToRoot.width}px;height:${overlayRelativeToRoot.height}px;z-index:9999;border-radius:${openedImageBorderRadius};overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.35);transition:all ${enlargeTransitionMs}ms ease-out;pointer-events:none;margin:0;transform:none;filter:${grayscale ? 'grayscale(1)' : 'none'};`;
      const originalImg = overlay.querySelector('img');
      if (originalImg) {
        const isVideo = originalImg.nodeName.toLowerCase() === 'video';
        const img = originalImg.cloneNode() as HTMLImageElement | HTMLVideoElement;
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;background:rgba(0,0,0,0.85);';
        if (isVideo) {
          (img as HTMLVideoElement).autoplay = true;
          (img as HTMLVideoElement).loop = true;
          (img as HTMLVideoElement).muted = true;
          (img as HTMLVideoElement).playsInline = true;
        }
        animatingOverlay.appendChild(img);
      }
      overlay.remove();
      rootRef.current!.appendChild(animatingOverlay);
      void animatingOverlay.getBoundingClientRect();
      requestAnimationFrame(() => {
        animatingOverlay.style.left = originalPosRelativeToRoot.left + 'px';
        animatingOverlay.style.top = originalPosRelativeToRoot.top + 'px';
        animatingOverlay.style.width = originalPosRelativeToRoot.width + 'px';
        animatingOverlay.style.height = originalPosRelativeToRoot.height + 'px';
        animatingOverlay.style.opacity = '0';
      });
      const cleanup = () => {
        animatingOverlay.remove();
        originalTilePositionRef.current = null;
        if (refDiv) refDiv.remove();
        parent.style.transition = 'none';
        el.style.transition = 'none';
        parent.style.setProperty('--rot-y-delta', '0deg');
        parent.style.setProperty('--rot-x-delta', '0deg');
        requestAnimationFrame(() => {
          el.style.visibility = '';
          el.style.opacity = '0';
          (el.style as any).zIndex = 0;
          focusedElRef.current = null;
          rootRef.current?.removeAttribute('data-enlarging');
          requestAnimationFrame(() => {
            parent.style.transition = '';
            el.style.transition = 'opacity 300ms ease-out';
            requestAnimationFrame(() => {
              el.style.opacity = '1';
              setTimeout(() => {
                el.style.transition = '';
                el.style.opacity = '';
                openingRef.current = false;
                if (!draggingRef.current && rootRef.current?.getAttribute('data-enlarging') !== 'true') {
                  document.body.classList.remove('dg-scroll-lock');
                }
              }, 300);
            });
          });
        });
      };
      animatingOverlay.addEventListener('transitionend', cleanup, { once: true });
    };
    scrim.addEventListener('click', close);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => { scrim.removeEventListener('click', close); window.removeEventListener('keydown', onKey); };
  }, [enlargeTransitionMs, openedImageBorderRadius, grayscale]);

  const openItemFromElement = (el: HTMLElement) => {
    if (openingRef.current) return;
    openingRef.current = true;
    openStartedAtRef.current = performance.now();
    lockScroll();
    const parent = el.parentElement as HTMLElement;
    focusedElRef.current = el;
    el.setAttribute('data-focused', 'true');
    const offsetX = getDataNumber(parent, 'offsetX', 0);
    const offsetY = getDataNumber(parent, 'offsetY', 0);
    const sizeX = getDataNumber(parent, 'sizeX', 2);
    const sizeY = getDataNumber(parent, 'sizeY', 2);
    const parentRot = computeItemBaseRotation(offsetX, offsetY, sizeX, sizeY, segments);
    const parentY = normalizeAngle(parentRot.rotateY);
    const globalY = normalizeAngle(rotationRef.current.y);
    let rotY = -(parentY + globalY) % 360;
    if (rotY < -180) rotY += 360;
    const rotX = -parentRot.rotateX - rotationRef.current.x;
    parent.style.setProperty('--rot-y-delta', `${rotY}deg`);
    parent.style.setProperty('--rot-x-delta', `${rotX}deg`);
    const refDiv = document.createElement('div');
    refDiv.className = 'item__image item__image--reference opacity-0';
    refDiv.style.transform = `rotateX(${-parentRot.rotateX}deg) rotateY(${-parentRot.rotateY}deg)`;
    parent.appendChild(refDiv);
    void refDiv.offsetHeight;
    const tileR = refDiv.getBoundingClientRect();
    const mainR = mainRef.current?.getBoundingClientRect();
    const frameR = frameRef.current?.getBoundingClientRect();
    if (!mainR || !frameR || tileR.width <= 0 || tileR.height <= 0) {
      openingRef.current = false;
      focusedElRef.current = null;
      parent.removeChild(refDiv);
      unlockScroll();
      return;
    }
    originalTilePositionRef.current = { left: tileR.left, top: tileR.top, width: tileR.width, height: tileR.height };
    el.style.visibility = 'hidden';
    (el.style as any).zIndex = 0;

    // ── Image overlay ───────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.className = 'enlarge';
    overlay.style.cssText = `position:absolute;left:${frameR.left - mainR.left}px;top:${frameR.top - mainR.top}px;width:${frameR.width}px;height:${frameR.height}px;opacity:0;z-index:30;will-change:transform,opacity;transform-origin:top left;transition:transform ${enlargeTransitionMs}ms ease, opacity ${enlargeTransitionMs}ms ease;border-radius:${openedImageBorderRadius};overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.35);`;
    const originalMedia = el.querySelector('img, video') as HTMLImageElement | HTMLVideoElement | null;
    const rawSrc = parent.dataset.src || originalMedia?.src || '';
    const rawAlt = parent.dataset.alt || originalMedia?.getAttribute('alt') || '';
    const rawCaption = parent.dataset.caption || '';
    const rawGuest = parent.dataset.guestName || '';

    const isVideo = rawSrc.match(/\.(mp4|webm|mov)$/i);
    const mediaEl = document.createElement(isVideo ? 'video' : 'img');
    mediaEl.src = rawSrc;
    if (isVideo) {
      (mediaEl as HTMLVideoElement).autoplay = true;
      (mediaEl as HTMLVideoElement).loop = true;
      (mediaEl as HTMLVideoElement).muted = true;
      (mediaEl as HTMLVideoElement).playsInline = true;
    } else {
      (mediaEl as HTMLImageElement).alt = rawAlt;
    }
    mediaEl.style.cssText = `width:100%;height:100%;object-fit:contain;filter:${grayscale ? 'grayscale(1)' : 'none'};background:rgba(0,0,0,0.85);`;
    overlay.appendChild(mediaEl);
    viewerRef.current!.appendChild(overlay);

    const tx0 = tileR.left - frameR.left;
    const ty0 = tileR.top - frameR.top;
    const sx0 = tileR.width / frameR.width;
    const sy0 = tileR.height / frameR.height;
    const validSx0 = isFinite(sx0) && sx0 > 0 ? sx0 : 1;
    const validSy0 = isFinite(sy0) && sy0 > 0 ? sy0 : 1;
    overlay.style.transform = `translate(${tx0}px, ${ty0}px) scale(${validSx0}, ${validSy0})`;

    setTimeout(() => {
      if (!overlay.parentElement) return;
      overlay.style.opacity = '1';
      overlay.style.transform = 'translate(0px, 0px) scale(1, 1)';
      rootRef.current?.setAttribute('data-enlarging', 'true');
    }, 16);

    // ── Caption card (responsive) ───────────────────────────────────────────
    const showCaptionCard = () => {
      const photoId = parent.dataset.id || '';
      const initialLikes = parseInt(parent.dataset.likes || '0', 10);
      let commentsRaw = [];
      try { commentsRaw = JSON.parse(parent.dataset.comments || '[]'); } catch (e) { }

      if (!rawCaption && !rawGuest && !photoId) return;

      const overlayRect = overlay.getBoundingClientRect();
      const mainRect = mainRef.current?.getBoundingClientRect();
      if (!mainRect) return;

      const isMobile = window.innerWidth < 680;
      const card = document.createElement('div');
      card.className = 'caption-card';

      // We add a like button with a specific ID to attach the listener later
      const cardInnerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;${!isMobile && rawCaption ? '' : 'margin-bottom:6px;'}">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.1rem;">DE:</span>
            <span style="font-family:'Cormorant Garamond',Georgia,serif;font-size:${isMobile ? '1rem' : '1.15rem'};font-weight:600;color:#fff;letter-spacing:0.02em;line-height:1.2;">${rawGuest || 'Invitado'}</span>
          </div>
          ${photoId ? `
            <button id="btn-like-${photoId}" class="like-btn" style="
              background: rgba(225,29,72,0.15);
              border: 1px solid rgba(225,29,72,0.3);
              color: white;
              border-radius: 99px;
              padding: 4px 10px;
              font-size: 0.8rem;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 4px;
              transition: all 0.2s;
            ">
              <span>❤️</span> <span class="like-count">${initialLikes || 0}</span>
            </button>
          ` : ''}
        </div>
        ${rawCaption ? `<p style="color:rgba(255,255,255,0.80);font-size:${isMobile ? '0.82rem' : '0.92rem'};line-height:1.55;margin:0;font-style:italic;font-family:'Georgia',serif;border-left:2px solid rgba(225,29,72,0.6);padding-left:10px;">"${rawCaption}"</p>` : ''}
        
        ${photoId ? `
          <div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:12px; margin-top:4px;">
                <div style="display:flex; justify-content:center; gap:8px; margin-bottom:12px;">
                  <button id="btn-polaroid-${photoId}" style="
                    background: linear-gradient(135deg, #e11d48, #db2777);
                    border: none; color: white; border-radius: 99px; padding: 6px 14px;
                    font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;
                  ">
                    <span>📱</span> Compartir Historia
                  </button>
                  </div>
            <div id="comments-list-${photoId}" style="max-height:100px; overflow-y:auto; display:flex; flex-direction:column; gap:6px; margin-bottom:8px;">
              ${commentsRaw.map((c: any) => `
                <div style="font-size:0.8rem; color:rgba(255,255,255,0.8);">
                  <strong style="color:var(--overlay-blur-color,#fff);">${c.author}:</strong> ${c.text}
                </div>
              `).join('')}
            </div>
            <div style="display:flex; gap:6px;">
              <input id="comment-input-${photoId}" type="text" placeholder="Comentar..." style="flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding:6px 10px; border-radius:6px; color:white; font-size:0.8rem; outline:none;" />
              <button id="btn-comment-${photoId}" style="background:rgba(225,29,72,0.8); border:none; padding:0 12px; border-radius:6px; color:white; font-size:0.8rem; cursor:pointer;">➔</button>
            </div>
          </div>
        ` : ''}
      `;

      if (isMobile) {
        // ── Mobile: centered below image ─────────────────────────────────────
        const cardTop = overlayRect.bottom - mainRect.top + 12;
        const cardLeft = Math.max(12, overlayRect.left - mainRect.left);
        const cardW = Math.min(overlayRect.width, mainRect.width - 24);
        card.style.cssText = `
          position: absolute;
          top: ${cardTop}px;
          left: ${cardLeft}px;
          width: ${cardW}px;
          z-index: 35;
          background: rgba(15,5,30,0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          padding: 14px 16px;
          opacity: 0;
          transform: translateY(12px);
          transition: opacity 350ms ease, transform 350ms ease;
          pointer-events: auto; /* ALLOW CLICKS */
          box-shadow: 0 6px 24px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          gap: 8px;
        `;
      } else {
        // ── Desktop: to the right of the image ────────────────────────────────
        const cardLeft = overlayRect.right - mainRect.left + 20;
        const cardTop = overlayRect.top - mainRect.top;
        const cardHeight = overlayRect.height;
        card.style.cssText = `
          position: absolute;
          left: ${cardLeft}px;
          top: ${cardTop}px;
          width: 300px;
          max-height: ${cardHeight}px;
          overflow-y: auto;
          z-index: 35;
          background: rgba(15,5,30,0.78);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 18px;
          padding: 24px 20px;
          opacity: 0;
          transform: translateX(16px);
          transition: opacity 380ms ease, transform 380ms ease;
          pointer-events: auto; /* ALLOW CLICKS */
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 12px;
        `;
      }

      card.innerHTML = cardInnerHTML;
      viewerRef.current!.appendChild(card);

      // Attach event listener for LIKE
      if (photoId) {
        const btn = card.querySelector(`#btn-like-${photoId}`);
        if (btn) {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation(); // prevent closing image
            const btnEl = e.currentTarget as HTMLButtonElement;
            btnEl.style.transform = 'scale(1.1)';
            setTimeout(() => btnEl.style.transform = 'scale(1)', 150);

            // Check localStorage to prevent massive spam? Optional, but good practice
            const likedKey = `astrogala_liked_${photoId}`;
            if (localStorage.getItem(likedKey)) return; // Already liked locally

            try {
              const res = await fetch(`/api/photos/${photoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'like' })
              });
              if (res.ok) {
                const data = await res.json();
                const countEl = btnEl.querySelector('.like-count');
                if (countEl) countEl.textContent = data.likes.toString();
                localStorage.setItem(likedKey, '1');
                btnEl.style.background = 'rgba(225,29,72,0.4)'; // Highlight button
                parent.dataset.likes = data.likes.toString(); // Update data-attribute so if reopened it reads correct
              }
            } catch (err) { console.error('Like error', err); }
          });

          // Style differently if already liked
          if (localStorage.getItem(`astrogala_liked_${photoId}`)) {
            (btn as HTMLElement).style.background = 'rgba(225,29,72,0.4)';
          }
        }

        // Setup Polaroid download
        const polaroidBtn = card.querySelector(`#btn-polaroid-${photoId}`) as HTMLButtonElement;
        if (polaroidBtn) {
          polaroidBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cancelTapRef.current = true;
            polaroidBtn.style.transform = 'scale(0.95)';
            setTimeout(() => polaroidBtn.style.transform = 'scale(1)', 150);
            const mediaSrc = parent.dataset.src || '';
            downloadPolaroid(mediaSrc, rawGuest, rawCaption);
          });
        }


        // Setup Comment logic
        const inputEl = card.querySelector(`#comment-input-${photoId}`) as HTMLInputElement;
        const submitBtn = card.querySelector(`#btn-comment-${photoId}`) as HTMLButtonElement;
        const listEl = card.querySelector(`#comments-list-${photoId}`) as HTMLDivElement;

        const handleCommentSubmit = async (e?: Event) => {
          e?.stopPropagation();
          const text = inputEl.value.trim();
          if (!text) return;
          const author = localStorage.getItem('astrogala_guest_name') || 'Invitado';
          inputEl.value = ''; // clear immediately
          // optimistic UI
          const div = document.createElement('div');
          div.style.cssText = 'font-size:0.8rem; color:rgba(255,255,255,0.8);';
          div.innerHTML = `<strong>${author}:</strong> ${text}`;
          listEl.appendChild(div);
          listEl.scrollTop = listEl.scrollHeight;
          let currentComments = [];
          try { currentComments = JSON.parse(parent.dataset.comments || '[]'); } catch (err) { }
          currentComments.push({ text, author });
          parent.dataset.comments = JSON.stringify(currentComments);

          try {
            await fetch(`/api/photos/${photoId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'comment', comment: { text, author } })
            });
          } catch (err) { }
        };

        if (inputEl && submitBtn) {
          inputEl.addEventListener('keydown', (e) => {
            e.stopPropagation(); // prevent closing image
            cancelTapRef.current = true; // prevent bubbling up tap
            if (e.key === 'Enter') handleCommentSubmit(e);
          });
          inputEl.addEventListener('click', e => { e.stopPropagation(); cancelTapRef.current = true; });
          submitBtn.addEventListener('click', handleCommentSubmit);
        }
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          card.style.opacity = '1';
          card.style.transform = isMobile ? 'translateY(0)' : 'translateX(0)';
        });
      });
    };

    const wantsResize = openedImageWidth || openedImageHeight;
    if (wantsResize) {
      const onFirstEnd = (ev: TransitionEvent) => {
        if (ev.propertyName !== 'transform') return;
        overlay.removeEventListener('transitionend', onFirstEnd);
        const prevTransition = overlay.style.transition;
        overlay.style.transition = 'none';
        const tempWidth = openedImageWidth || `${frameR.width}px`;
        const tempHeight = openedImageHeight || `${frameR.height}px`;
        overlay.style.width = tempWidth;
        overlay.style.height = tempHeight;
        const newRect = overlay.getBoundingClientRect();
        overlay.style.width = frameR.width + 'px';
        overlay.style.height = frameR.height + 'px';
        void overlay.offsetWidth;
        overlay.style.transition = `left ${enlargeTransitionMs}ms ease, top ${enlargeTransitionMs}ms ease, width ${enlargeTransitionMs}ms ease, height ${enlargeTransitionMs}ms ease`;
        const centeredLeft = frameR.left - mainR.left + (frameR.width - newRect.width) / 2;
        const centeredTop = frameR.top - mainR.top + (frameR.height - newRect.height) / 2;
        requestAnimationFrame(() => {
          overlay.style.left = `${centeredLeft}px`;
          overlay.style.top = `${centeredTop}px`;
          overlay.style.width = tempWidth;
          overlay.style.height = tempHeight;
        });
        const cleanupSecond = () => {
          overlay.removeEventListener('transitionend', cleanupSecond);
          overlay.style.transition = prevTransition;
          // Show caption after image finishes repositioning
          showCaptionCard();
        };
        overlay.addEventListener('transitionend', cleanupSecond, { once: true });
      };
      overlay.addEventListener('transitionend', onFirstEnd);
    } else {
      // Show caption after initial animation
      setTimeout(showCaptionCard, enlargeTransitionMs + 60);
    }
  };

  useEffect(() => { return () => { document.body.classList.remove('dg-scroll-lock'); }; }, []);

  const cssStyles = `
    .sphere-root {
      --radius: 520px;
      --viewer-pad: 72px;
      --circ: calc(var(--radius) * 3.14);
      --rot-y: calc((360deg / var(--segments-x)) / 2);
      --rot-x: calc((360deg / var(--segments-y)) / 2);
      --item-width: calc(var(--circ) / var(--segments-x));
      --item-height: calc(var(--circ) / var(--segments-y));
    }
    .sphere-root * { box-sizing: border-box; }
    .sphere, .sphere-item, .item__image { transform-style: preserve-3d; }
    .stage {
      width: 100%; height: 100%; display: grid; place-items: center;
      position: absolute; inset: 0; margin: auto;
      perspective: calc(var(--radius) * 2);
      perspective-origin: 50% 50%;
    }
    .sphere {
      transform: translateZ(calc(var(--radius) * -1));
      will-change: transform;
      position: absolute;
    }
    .sphere-item {
      width: calc(var(--item-width) * var(--item-size-x));
      height: calc(var(--item-height) * var(--item-size-y));
      position: absolute;
      top: -999px; bottom: -999px; left: -999px; right: -999px;
      margin: auto;
      transform-origin: 50% 50%;
      backface-visibility: hidden;
      transition: transform 300ms;
      transform:
        rotateY(calc(var(--rot-y) * (var(--offset-x) + ((var(--item-size-x) - 1) / 2)) + var(--rot-y-delta, 0deg)))
        rotateX(calc(var(--projection-sphere) * var(--rot-x) * (var(--offset-y) - ((var(--item-size-y) - 1) / 2)) + var(--rot-x-delta, 0deg)))
        translateY(calc(var(--projection-cylinder) * var(--item-height) * 1.1 * var(--offset-y)))
        translateZ(var(--radius));
    }
    .sphere-root[data-enlarging="true"] .scrim { opacity: 1 !important; pointer-events: all !important; }
    @media (max-aspect-ratio: 1/1) { .viewer-frame { height: auto !important; width: 100% !important; } }
    .item__image {
      position: absolute; inset: 4px;
      border-radius: var(--tile-radius, 12px);
      overflow: hidden; cursor: pointer;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      transition: transform 300ms;
      pointer-events: auto;
      transform: translateZ(0);
      background: rgba(0,0,0,0.2);
    }
    .item__image img, .item__image video {
      width: 100%; height: 100%; object-fit: cover;
    }
    .item__image--reference { position: absolute; inset: 4px; pointer-events: none; }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssStyles }} />
      <div
        ref={rootRef}
        className="sphere-root relative w-full h-full"
        style={{
          ['--segments-x' as any]: segments,
          ['--segments-y' as any]: segments,
          ['--overlay-blur-color' as any]: overlayBlurColor,
          ['--tile-radius' as any]: imageBorderRadius,
          ['--enlarge-radius' as any]: openedImageBorderRadius,
          ['--image-filter' as any]: grayscale ? 'grayscale(1)' : 'none',
          ['--projection-sphere' as any]: projection === 'sphere' ? 1 : 0,
          ['--projection-cylinder' as any]: projection === 'cylinder' ? 1 : 0,
        } as React.CSSProperties}
      >
        <main
          ref={mainRef}
          className="absolute inset-0 grid place-items-center overflow-hidden select-none bg-transparent"
          style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
        >
          <div className="stage">
            <div ref={sphereRef} className="sphere">
              {items.map((it, i) => (
                <div
                  key={`${it.x},${it.y},${i}`}
                  className="sphere-item absolute m-auto"
                  data-src={it.src}
                  data-alt={it.alt}
                  data-caption={it.caption}
                  data-guest-name={it.guestName}
                  data-id={it.id}
                  data-likes={it.likes}
                  data-comments={JSON.stringify(it.comments || [])}
                  data-offset-x={it.x}
                  data-offset-y={it.y}
                  data-size-x={it.sizeX}
                  data-size-y={it.sizeY}
                  style={{
                    ['--offset-x' as any]: it.x,
                    ['--offset-y' as any]: it.y,
                    ['--item-size-x' as any]: it.sizeX,
                    ['--item-size-y' as any]: it.sizeY,
                    top: '-999px', bottom: '-999px', left: '-999px', right: '-999px',
                  } as React.CSSProperties}
                >
                  <div
                    className="item__image absolute block overflow-hidden cursor-pointer transition-transform duration-300"
                    role="button"
                    tabIndex={0}
                    aria-label={it.alt || 'Ver foto'}
                    onClick={e => {
                      if (draggingRef.current || movedRef.current) return;
                      if (performance.now() - lastDragEndAt.current < 80) return;
                      if (openingRef.current) return;
                      openItemFromElement(e.currentTarget as HTMLElement);
                    }}
                    onPointerUp={e => {
                      if ((e.nativeEvent as PointerEvent).pointerType !== 'touch') return;
                      if (draggingRef.current || movedRef.current) return;
                      if (performance.now() - lastDragEndAt.current < 80) return;
                      if (openingRef.current) return;
                      openItemFromElement(e.currentTarget as HTMLElement);
                    }}
                    style={{ inset: '10px', borderRadius: `var(--tile-radius, ${imageBorderRadius})`, backfaceVisibility: 'hidden' }}
                  >
                    {it.src.match(/\.(mp4|webm|mov)$/i) ? (
                      <div className="relative w-full h-full">
                        <video
                          src={`${it.src}#t=0.001`}
                          preload="metadata"
                          className="w-full h-full object-cover pointer-events-none"
                          style={{ backfaceVisibility: 'hidden', filter: `var(--image-filter, ${grayscale ? 'grayscale(1)' : 'none'})` }}
                        />
                        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.1)', pointerEvents: 'none' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', display: 'grid', placeItems: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={it.src}
                        draggable={false}
                        alt={it.alt}
                        className="w-full h-full object-cover pointer-events-none"
                        style={{ backfaceVisibility: 'hidden', filter: `var(--image-filter, ${grayscale ? 'grayscale(1)' : 'none'})` }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Radial overlay */}
          <div className="absolute inset-0 m-auto z-[3] pointer-events-none" style={{ backgroundImage: `radial-gradient(rgba(235,235,235,0) 65%, var(--overlay-blur-color,${overlayBlurColor}) 100%)` }} />
          <div className="absolute inset-0 m-auto z-[3] pointer-events-none" style={{ WebkitMaskImage: `radial-gradient(rgba(235,235,235,0) 70%, var(--overlay-blur-color,${overlayBlurColor}) 90%)`, maskImage: `radial-gradient(rgba(235,235,235,0) 70%, var(--overlay-blur-color,${overlayBlurColor}) 90%)`, backdropFilter: 'blur(3px)' }} />
          <div className="absolute left-0 right-0 top-0 h-[120px] z-[5] pointer-events-none rotate-180" style={{ background: `linear-gradient(to bottom, transparent, var(--overlay-blur-color,${overlayBlurColor}))` }} />
          <div className="absolute left-0 right-0 bottom-0 h-[120px] z-[5] pointer-events-none" style={{ background: `linear-gradient(to bottom, transparent, var(--overlay-blur-color,${overlayBlurColor}))` }} />

          {/* Viewer (overlay + scrim + frame + caption card live here) */}
          <div ref={viewerRef} className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center" style={{ padding: 'var(--viewer-pad)' }}>
            <div ref={scrimRef} className="scrim absolute inset-0 z-10 pointer-events-none opacity-0 transition-opacity duration-500" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} />
            <div ref={frameRef} className="viewer-frame h-full aspect-square flex" style={{ borderRadius: `var(--enlarge-radius,${openedImageBorderRadius})` }} />
          </div>
        </main>
      </div>
    </>
  );
}
