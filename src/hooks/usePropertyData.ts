import { useState, useCallback, useEffect } from 'react';
import type { PropertyFile, PropertyFolder } from '../../types';
import { propertyService } from '../services';
import { supabase } from '../utils/supabaseClient';

interface PropertyDataCache {
  files: PropertyFile[];
  folders: PropertyFolder[];
  lastFetched: number;
}

const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Hook for managing property data (files and folders)
 * Handles loading, caching, and state management for property files and folders
 */
export function usePropertyData() {
  const [propertyFiles, setPropertyFiles] = useState<PropertyFile[]>([]);
  const [folders, setFolders] = useState<PropertyFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('master');
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(true);
  const [propertyCache, setPropertyCache] = useState<Record<string, PropertyDataCache>>({});

  // Expose cache globally for property switcher
  useEffect(() => {
    (globalThis as {
      __droppoint_property_cache?: Record<string, PropertyDataCache>;
    }).__droppoint_property_cache = propertyCache;
  }, [propertyCache]);

  const isPropertyDataCached = useCallback(async (address: string): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const cacheKey = `${user.id}-${address}`;
    const cached = propertyCache[cacheKey];
    return cached && (Date.now() - cached.lastFetched) < CACHE_TIMEOUT;
  }, [propertyCache]);

  const cachePropertyData = useCallback(async (
    address: string,
    files: PropertyFile[],
    folders: PropertyFolder[]
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const cacheKey = `${user.id}-${address}`;
    setPropertyCache(prev => ({
      ...prev,
      [cacheKey]: {
        files,
        folders,
        lastFetched: Date.now()
      }
    }));
  }, []);

  const getCachedPropertyData = useCallback(async (address: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const cacheKey = `${user.id}-${address}`;
    const cached = propertyCache[cacheKey];
    if (cached && (Date.now() - cached.lastFetched) < CACHE_TIMEOUT) {
      return cached;
    }
    return null;
  }, [propertyCache]);

  return {
    propertyFiles,
    setPropertyFiles,
    folders,
    setFolders,
    selectedFolder,
    setSelectedFolder,
    foldersLoading,
    setFoldersLoading,
    filesLoading,
    setFilesLoading,
    propertyCache,
    setPropertyCache,
    isPropertyDataCached,
    cachePropertyData,
    getCachedPropertyData
  };
}

