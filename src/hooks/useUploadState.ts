import { useState } from 'react';
import type { PendingUpload } from '../../types';

/**
 * Hook for managing upload-related state
 * Handles pending uploads and file renaming state
 */
export function useUploadState() {
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);

  return {
    pendingUploads,
    setPendingUploads,
    renamingFileId,
    setRenamingFileId
  };
}

