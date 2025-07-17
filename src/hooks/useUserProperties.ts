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

      // First, get all properties for the user
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (propertiesError) {
        throw propertiesError;
      }

      if (!propertiesData || propertiesData.length === 0) {
        setProperties([]);
        return;
      }

      // Get file counts for each property
      const propertiesWithCounts: PropertyWithFileCount[] = await Promise.all(
        propertiesData.map(async (property) => {
          const { count, error: countError } = await supabase
            .from('property_files')
            .select('*', { count: 'exact', head: true })
            .eq('property_id', property.id);

          if (countError) {
            console.error('Error counting files for property', property.id, countError);
          }

          return {
            ...property,
            file_count: count || 0,
            last_accessed: property.updated_at || property.created_at
          };
        })
      );

      // Sort by last accessed (most recent first), then by created date
      const sortedProperties = propertiesWithCounts.sort((a, b) => {
        const aDate = new Date(a.last_accessed || a.created_at || '1970-01-01');
        const bDate = new Date(b.last_accessed || b.created_at || '1970-01-01');
        return bDate.getTime() - aDate.getTime();
      });

      setProperties(sortedProperties);
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