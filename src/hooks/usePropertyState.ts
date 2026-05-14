import { logger } from '../utils/logger';
import { useState, useCallback } from 'react';
import type { Property } from '../../types';
import { propertyService } from '../services';

/**
 * Hook for managing property-related state
 * Handles user properties, selected property, and saved property
 */
export function usePropertyState() {
  const [userProperties, setUserProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [savedProperty, setSavedProperty] = useState<Property | null>(null);
  const [propertiesLoaded, setPropertiesLoaded] = useState(false);

  const loadUserProperties = useCallback(async () => {
    try {
      const properties = await propertyService.getUserProperties();
      setUserProperties(properties);
    } catch (error) {
      logger.error('[PropertyState] Error loading user properties:', error);
    } finally {
      setPropertiesLoaded(true);
    }
  }, []);

  return {
    userProperties,
    setUserProperties,
    selectedProperty,
    setSelectedProperty,
    savedProperty,
    setSavedProperty,
    propertiesLoaded,
    setPropertiesLoaded,
    loadUserProperties
  };
}

