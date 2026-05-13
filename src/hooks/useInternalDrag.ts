import { useCallback, useEffect, useRef, useState } from 'react';
import type { PropertyFile } from '../../types';

/**
 * Custom MIME type that marks a DragEvent as originating from inside the
 * app (a file row being dragged) rather than an OS file drop (uploads).
 *
 * dataTransfer.types is the only payload readable during dragover for
 * security reasons — `getData` returns "" until drop. So drop targets
 * use this MIME's presence in types to recognize an internal drag without
 * being able to read the dragged item's id mid-drag. The dragged item
 * itself lives in component state via useInternalDrag.
 */
export const INTERNAL_DRAG_MIME = 'application/x-droppoint-item';

export type InternalDragItem =
  | {
      kind: 'file';
      file: PropertyFile;
      /** folder_id of the file being dragged — used to short-circuit
       *  "drop into your own current folder" no-op moves. */
      sourceFolderId: string | null;
    };

export interface DropTargetProps {
  /** Stable id used for visual highlight bookkeeping. */
  id: string;
  /** If false, all handlers no-op. Use for the source folder (can't drop
   *  on yourself) and for any disabled / invalid target. */
  canAccept: boolean;
  /** Fires after `springDelay` ms of continuous hover. Use it to navigate
   *  the view (open a folder, jump up a breadcrumb level) so the user can
   *  keep dragging deeper without releasing. */
  spring?: () => void;
  /** Fires when the user releases the drag over this target. Receives the
   *  dragged item so the caller doesn't have to read it from the hook
   *  (and doesn't have to deal with the type narrowing of a possibly-null
   *  state value). The hook guarantees this is non-null when onDrop runs. */
  onDrop: (item: InternalDragItem) => void;
}

interface UseInternalDragOptions {
  /** ms of continuous hover before `spring` fires. macOS Finder uses ~700ms;
   *  600 feels responsive without being trigger-happy. */
  springDelay?: number;
}

/**
 * Spring-loaded internal drag-and-drop, modeled on macOS Finder behavior.
 *
 * Drag a file row, hover over a folder row → after springDelay ms the
 * folder auto-opens (via the spring callback). Keep hovering deeper to
 * descend. Hover over a breadcrumb crumb to go back up. Release to
 * commit the move via onDrop.
 *
 * Returns:
 *  - getDragSourceProps(item): spread onto the draggable row.
 *  - getDropTargetProps({ id, canAccept, spring, onDrop }): spread onto
 *    each drop-eligible element (folder rows, breadcrumb crumbs).
 *  - isDragging / draggedItem / activeTargetId: for visual feedback.
 *  - cancelDrag(): force reset (used by window-level safety net).
 *
 * Touch caveat: HTML5 drag-and-drop is desktop-only. Touch devices need
 * a separate gesture (long-press + drag) or a library shim — out of
 * scope for this iteration.
 */
export function useInternalDrag(options: UseInternalDragOptions = {}) {
  const { springDelay = 600 } = options;

  const [draggedItem, setDraggedItem] = useState<InternalDragItem | null>(null);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);

  // Refs (not state) for the spring timer and its target id, so dragenter/
  // dragleave can mutate them synchronously without triggering re-renders.
  const springTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const springTargetIdRef = useRef<string | null>(null);

  const clearSpringTimer = useCallback(() => {
    if (springTimerRef.current) {
      clearTimeout(springTimerRef.current);
      springTimerRef.current = null;
    }
    springTargetIdRef.current = null;
  }, []);

  const cancelDrag = useCallback(() => {
    clearSpringTimer();
    setDraggedItem(null);
    setActiveTargetId(null);
  }, [clearSpringTimer]);

  // Window-level safety net: if the drag ends outside any of our drop
  // targets (Esc, drop on the OS, tab switch), neither our dragend nor
  // drop handlers fire. Listening at the window level guarantees we
  // always clean up.
  useEffect(() => {
    if (!draggedItem) return;
    const onEnd = () => cancelDrag();
    window.addEventListener('dragend', onEnd);
    window.addEventListener('drop', onEnd);
    return () => {
      window.removeEventListener('dragend', onEnd);
      window.removeEventListener('drop', onEnd);
    };
  }, [draggedItem, cancelDrag]);

  const getDragSourceProps = useCallback((item: InternalDragItem) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      // The value we setData here is opaque to drop targets (they read
      // from React state instead) — but we still set SOMETHING with our
      // custom MIME so `dataTransfer.types.includes(INTERNAL_DRAG_MIME)`
      // returns true during dragover.
      e.dataTransfer.setData(INTERNAL_DRAG_MIME, item.kind === 'file' ? item.file.id : '');
      e.dataTransfer.effectAllowed = 'move';
      setDraggedItem(item);
    },
    onDragEnd: () => cancelDrag(),
  }), [cancelDrag]);

  const getDropTargetProps = useCallback((params: DropTargetProps) => {
    const { id, canAccept, spring, onDrop } = params;

    return {
      onDragEnter: (e: React.DragEvent) => {
        if (!draggedItem || !canAccept) return;
        if (!e.dataTransfer.types.includes(INTERNAL_DRAG_MIME)) return;
        e.preventDefault();
        e.stopPropagation();
        setActiveTargetId(id);

        // Only schedule the spring action if we're newly entering THIS
        // target. Without this guard, every dragenter on a child would
        // reset the timer.
        if (spring && springTargetIdRef.current !== id) {
          clearSpringTimer();
          springTargetIdRef.current = id;
          springTimerRef.current = setTimeout(() => {
            // Navigate. The current target will likely unmount as the view
            // changes; that's fine — drag state survives the re-render so
            // the user can keep dragging into the new view.
            spring();
            clearSpringTimer();
            setActiveTargetId(null);
          }, springDelay);
        }
      },
      onDragOver: (e: React.DragEvent) => {
        if (!draggedItem || !canAccept) return;
        if (!e.dataTransfer.types.includes(INTERNAL_DRAG_MIME)) return;
        // preventDefault is what makes the element an actual drop target
        // (without it the browser refuses the drop). Setting dropEffect
        // gives the user the correct cursor.
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!draggedItem || !canAccept) return;
        // Same child-element guard as the upload overlay: dragleave fires
        // when the cursor crosses into a CHILD too. We only want to clear
        // when leaving the target entirely.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        if (activeTargetId === id) setActiveTargetId(null);
        if (springTargetIdRef.current === id) clearSpringTimer();
      },
      onDrop: (e: React.DragEvent) => {
        if (!draggedItem || !canAccept) return;
        if (!e.dataTransfer.types.includes(INTERNAL_DRAG_MIME)) return;
        e.preventDefault();
        e.stopPropagation();
        // Snapshot the item before cancelDrag clears state — we want the
        // caller's handler to see what was being dragged, not null.
        const item = draggedItem;
        onDrop(item);
        cancelDrag();
      },
    };
  }, [draggedItem, activeTargetId, springDelay, clearSpringTimer, cancelDrag]);

  return {
    draggedItem,
    activeTargetId,
    isDragging: draggedItem !== null,
    getDragSourceProps,
    getDropTargetProps,
    cancelDrag,
  };
}
