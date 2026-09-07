import { logger } from '../utils/logger';
import { useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import type { PropertyFile, PropertyFolder, PropertyWithFileCount } from '../../types';
import { propertyService } from '../services';
import { getPropertyDataSync, setPropertyDataCache } from './usePropertyPrefetch';

interface UsePropertySwitcherProps {
  onMapMove?: (lat: number, lng: number) => void;
  onPropertyDataLoad?: (property: PropertyWithFileCount, files: PropertyFile[], folders: PropertyFolder[]) => void;
  onLoadingStateChange?: (loading: boolean) => void;
  onError?: (error: string) => void;
}

/**
 * Switches the open modal to another property: pans the map, serves files
 * and folders from the shared prefetch cache when fresh, otherwise fetches
 * them, and bumps the property's updated_at so "recent" ordering stays
 * meaningful.
 */
export const usePropertySwitcher = ({
  onMapMove,
  onPropertyDataLoad,
  onLoadingStateChange,
  onError,
}: UsePropertySwitcherProps) => {
  const switchToProperty = useCallback(async (property: PropertyWithFileCount) => {
    if (!property.id) return;
    try {
      onLoadingStateChange?.(true);
      onMapMove?.(property.lat, property.lng);

      const cached = getPropertyDataSync(property.id);
      let files: PropertyFile[];
      let folders: PropertyFolder[];
      if (cached) {
        ({ files, folders } = cached);
      } else {
        ({ files, folders } = await propertyService.getPropertyData(property.id));
        setPropertyDataCache(property.id, files, folders);
      }

      onPropertyDataLoad?.(property, files, folders);

      // Fire-and-forget recency bump.
      void supabase
        .from('properties')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', property.id);
    } catch (error) {
      logger.error('Error switching to property:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to switch property');
    } finally {
      onLoadingStateChange?.(false);
    }
  }, [onMapMove, onPropertyDataLoad, onLoadingStateChange, onError]);

  return { switchToProperty };
};
