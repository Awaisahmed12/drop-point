import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../utils/supabaseClient';
import type { AdminConfiguration } from '../../types';

interface ConfigContextType {
  configurations: Record<string, unknown>;
  loading: boolean;
  error: string | null;
  refreshConfigurations: () => Promise<void>;
  updateConfiguration: (key: string, value: unknown) => Promise<void>;
  // Specific config getters
  streetViewEnabled: boolean;
  propertyImageEnabled: boolean;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [configurations, setConfigurations] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigurations = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('admin_configurations')
        .select('*')
        .eq('is_active', true);

      if (fetchError) {
        throw fetchError;
      }

      // Convert array to object with key as the key
      const configObject: Record<string, unknown> = {};
      data?.forEach((config: AdminConfiguration) => {
        configObject[config.key] = config.value;
      });

      setConfigurations(configObject);
    } catch (err) {
      console.error('Error fetching configurations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch configurations');
      
      // Set default configurations if fetch fails
      setConfigurations({
        street_view_enabled: true, // Default to enabled
      });
    } finally {
      setLoading(false);
    }
  };

  const updateConfiguration = async (key: string, value: unknown) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: updateError } = await supabase
        .from('admin_configurations')
        .upsert({
          key,
          value,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'key' 
        });

      if (updateError) {
        throw updateError;
      }

      // Refresh configurations from database
      await fetchConfigurations();
    } catch (err) {
      console.error('Error updating configuration:', err);
      throw err;
    }
  };

  const refreshConfigurations = async () => {
    await fetchConfigurations();
  };

  // Computed values for specific configurations
  const streetViewEnabled = configurations.street_view_enabled === true || configurations.street_view_enabled === 'true';
  const propertyImageEnabled = configurations.property_image_enabled === true || configurations.property_image_enabled === 'true';

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const value: ConfigContextType = {
    configurations,
    loading,
    error,
    refreshConfigurations,
    updateConfiguration,
    streetViewEnabled,
    propertyImageEnabled,
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

// Hook for admin operations (requires admin privileges)
export const useAdminConfig = () => {
  const config = useConfig();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsAdmin(false);
          setAdminLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('user_type')
          .eq('user_id', user.id)
          .single();

        setIsAdmin(profile?.user_type === 'Admin');
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setAdminLoading(false);
      }
    };

    checkAdminStatus();
  }, []);

  return {
    ...config,
    isAdmin,
    adminLoading,
  };
};
