import { useState, useRef } from 'react';

/**
 * Hook for managing menu-related state
 * Handles menu visibility and refs for click-outside detection
 */
export function useMenuState() {
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [fileMenuId, setFileMenuId] = useState<string | null>(null);
  const folderMenuRef = useRef<HTMLDivElement | null>(null);
  const fileMenuRef = useRef<HTMLDivElement | null>(null);

  return {
    folderMenuId,
    setFolderMenuId,
    fileMenuId,
    setFileMenuId,
    folderMenuRef,
    fileMenuRef
  };
}

