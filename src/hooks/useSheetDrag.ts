import { useCallback, useRef, useState } from 'react';
import type React from 'react';

interface UseSheetDragOptions {
  onDismiss: () => void;
  /** Pixels the sheet must travel before release dismisses it. */
  threshold?: number;
}

/**
 * Pull-to-dismiss for bottom sheets. Spread `handleProps` on the grabber /
 * nav-bar zone and `sheetStyle` on the sheet itself: the sheet follows the
 * finger, springs back on a short pull, and slides off then dismisses on a
 * long or fast one.
 */
export function useSheetDrag({ onDismiss, threshold = 110 }: UseSheetDragOptions) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ y: number; t: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startRef.current = { y: e.clientY, t: Date.now() };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!startRef.current) return;
    // Resist upward pulls; follow downward ones 1:1.
    setOffset(Math.max(0, e.clientY - startRef.current.y));
  }, []);

  const finish = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!startRef.current) return;
    const dy = Math.max(0, e.clientY - startRef.current.y);
    const velocity = dy / Math.max(Date.now() - startRef.current.t, 1); // px per ms
    startRef.current = null;
    setDragging(false);
    if (dy > threshold || (dy > 24 && velocity > 0.7)) {
      setOffset(window.innerHeight);
      window.setTimeout(() => {
        onDismiss();
        setOffset(0);
      }, 200);
    } else {
      setOffset(0);
    }
  }, [onDismiss, threshold]);

  return {
    dragging,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      style: { touchAction: 'none' as const },
    },
    sheetStyle: {
      transform: offset ? `translateY(${offset}px)` : undefined,
      transition: dragging ? 'none' : 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    } as React.CSSProperties,
  };
}
