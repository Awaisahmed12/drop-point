import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import type { PropertyWithFileCount } from '../../types';

export interface UseUserPropertiesReturn {
  properties: PropertyWithFileCount[];
  loading: boolean;
  error: string | null;
  refreshProperties: () => Promise<void>;
  updateLastAccessed: (propertyId: string) => Promise<void>;
}

export const useUserProperties = (): UseUserPropertiesReturn => {
  const [properties, setProperties] = useState<PropertyWithFileCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFreshProperties = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProperties([]);
        setLoading(false);
        return;
      }

      console.log('📋 [PROPERTIES] Fetching fresh properties data...');

      // Fetch properties with file counts using a more efficient query
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select(`
          id, address, lat, lng, label, notes, created_at, updated_at,
          property_files!left(id)
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (propertiesError) {
        throw propertiesError;
      }

      // Transform to PropertyWithFileCount format
      const propertiesWithCount: PropertyWithFileCount[] = (propertiesData || []).map(property => ({
        ...property,
        file_count: property.property_files?.length || 0,
        last_accessed: property.updated_at,
        user_id: user.id
      }));

      setProperties(propertiesWithCount);
      
      // Update cache with fresh data
      sessionStorage.setItem('droppoint-properties-cache', JSON.stringify({
        properties: propertiesWithCount,
        timestamp: Date.now()
      }));

      console.log('📋 [PROPERTIES] Fresh data loaded and cached:', propertiesWithCount.length);
    } catch (error) {
      console.error('Error fetching fresh properties:', error);
      setError(error instanceof Error ? error.message : 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check for cached data first for instant loading
      const cached = sessionStorage.getItem('droppoint-properties-cache');
      if (cached) {
        try {
          const cacheData = JSON.parse(cached);
          const cacheAge = Date.now() - cacheData.timestamp;
          
          // Use cache if less than 5 minutes old
          if (cacheAge < 5 * 60 * 1000) {
            console.log('📋 [PROPERTIES] Using cached data for instant load');
            setProperties(cacheData.properties);
            setLoading(false);
            
            // Fetch fresh data in background to update cache
            setTimeout(() => fetchFreshProperties(), 100);
            return;
          }
        } catch (error) {
          console.error('Error parsing cached properties:', error);
        }
      }

      // No valid cache, fetch fresh data
      await fetchFreshProperties();
    } catch (error) {
      console.error('Error in fetchProperties:', error);
      setError(error instanceof Error ? error.message : 'Failed to load properties');
      setLoading(false);
    }
  }, [fetchFreshProperties]);

  const updateLastAccessed = useCallback(async (propertyId: string) => {
    try {
      const { error } = await supabase
        .from('properties')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', propertyId);

      if (error) {
        console.error('Error updating last accessed:', error);
      }
    } catch (err) {
      console.error('Error updating last accessed:', err);
    }
  }, []);

  const refreshProperties = useCallback(async () => {
    await fetchFreshProperties();
  }, [fetchFreshProperties]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  return {
    properties,
    loading,
    error,
    refreshProperties,
    updateLastAccessed
  };
}; 