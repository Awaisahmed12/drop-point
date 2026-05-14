import { logger } from '../utils/logger';
import { useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import type { PropertyFile, PropertyFolder } from '../../types';
import type { PropertyWithFileCount } from '../../types';

interface UsePropertySwitcherProps {
  onMapMove?: (lat: number, lng: number) => void;
  onPropertyDataLoad?: (property: PropertyWithFileCount, files: PropertyFile[], folders: PropertyFolder[]) => void;
  onLoadingStateChange?: (loading: boolean) => void;
  onError?: (error: string) => void;
  propertyCache?: Record<string, {
    files: PropertyFile[];
    folders: PropertyFolder[];
    lastFetched: number;
  }>;
  cacheTimeout?: number;
}

interface UsePropertySwitcherReturn {
  switchToProperty: (property: PropertyWithFileCount) => Promise<void>;
}

export const usePropertySwitcher = ({
  onMapMove,
  onPropertyDataLoad,
  onLoadingStateChange,
  onError,
  propertyCache = {},
  cacheTimeout = 5 * 60 * 1000 // 5 minutes
}: UsePropertySwitcherProps): UsePropertySwitcherReturn => {

  const switchToProperty = useCallback(async (property: PropertyWithFileCount) => {
    try {
      onLoadingStateChange?.(true);

      // Move map to property location immediately
      if (onMapMove) {
        onMapMove(property.lat, property.lng);
      }

      // Check cache first for instant data loading
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      if (!property.id) {
        throw new Error('Property ID is required');
      }

      const cacheKey = `${user.id}-${property.address}`;
      const cached = propertyCache[cacheKey];
      
      if (cached && (Date.now() - cached.lastFetched) < cacheTimeout) {
        // Use cached data immediately
        if (onPropertyDataLoad) {
          onPropertyDataLoad(property, cached.files, cached.folders);
        }

        // Update last accessed in background (fire-and-forget with silent error handling)
        void supabase
          .from('properties')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', property.id);

        return;
      }

      // No cache - fetch fresh data

      // Fetch folders and files for the property
      const [folderResult, filesResult] = await Promise.all([
        supabase
          .from('property_folders')
          .select('*')
          .eq('property_id', property.id)
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: true }),
        supabase
          .from('property_files')
          .select('*')
          .eq('property_id', property.id)
          .order('uploaded_at', { ascending: false })
      ]);

      if (folderResult.error) {
        throw folderResult.error;
      }

      if (filesResult.error) {
        throw filesResult.error;
      }

      // Update last accessed timestamp
      await supabase
        .from('properties')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', property.id);

      // Call the data load callback with fresh data
      if (onPropertyDataLoad) {
        onPropertyDataLoad(property, filesResult.data || [], folderResult.data || []);
      }

    } catch (error) {
      logger.error('Error switching to property:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to switch property');
    } finally {
      onLoadingStateChange?.(false);
    }
  }, [onMapMove, onPropertyDataLoad, onLoadingStateChange, onError, propertyCache, cacheTimeout]);

  return { switchToProperty };
}; 
