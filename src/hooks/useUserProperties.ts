import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import type { Property } from '../../types';

export interface PropertyWithFileCount extends Property {
  file_count: number;
  last_accessed?: string;
  created_at?: string;
  updated_at?: string;
}

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

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        return;
      }

      // Fetch properties with file counts using a join query
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select(`
          *,
          property_files!inner(id)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (propertiesError) {
        throw propertiesError;
      }

      // Transform data to include file counts
      const propertiesWithCounts: PropertyWithFileCount[] = propertiesData?.map(property => ({
        ...property,
        file_count: property.property_files?.length || 0,
        // Use updated_at if available, otherwise created_at
        last_accessed: property.updated_at || property.created_at
      })) || [];

      // Filter out properties with no files
      const propertiesWithFiles = propertiesWithCounts.filter(p => p.file_count > 0);

      setProperties(propertiesWithFiles);
    } catch (err) {
      console.error('Error fetching user properties:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch properties');
    } finally {
      setLoading(false);
    }
  }, []);

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
    await fetchProperties();
  }, [fetchProperties]);

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