import type { PropertyFile, PropertyFolder } from '../types';
import { COORDINATE_THRESHOLD } from '../constants';

// Address cache for reverse geocoding
const addressCache = new Map<string, { address: string; snappedLatLng: { lat: number; lng: number } | null }>();

// Property data cache for files and folders
const propertyDataCache = new Map<string, { files: PropertyFile[]; folders: PropertyFolder[] }>();

/**
 * Gets cached address for given coordinates
 */
export function getAddressFromCache(lat: number, lng: number): { address: string; snappedLatLng: { lat: number; lng: number } | null } | null {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  return addressCache.get(key) || null;
}

/**
 * Saves address to cache with coordinates
 */
export function saveAddressToCache(
  lat: number, 
  lng: number, 
  address: string, 
  snappedLatLng: { lat: number; lng: number } | null
): void {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  addressCache.set(key, { address, snappedLatLng });
}

/**
 * Checks if property data is cached for a given address
 */
export function isPropertyDataCached(address: string): boolean {
  return propertyDataCache.has(address);
}

/**
 * Caches property data (files and folders) for an address
 */
export function cachePropertyData(address: string, files: PropertyFile[], folders: PropertyFolder[]): void {
  propertyDataCache.set(address, { files, folders });
}

/**
 * Gets cached property data for an address
 */
export function getCachedPropertyData(address: string): { files: PropertyFile[]; folders: PropertyFolder[] } | null {
  return propertyDataCache.get(address) || null;
}

/**
 * Clears all cached data
 */
export function clearAllCache(): void {
  addressCache.clear();
  propertyDataCache.clear();
}

/**
 * Clears cached property data for a specific address
 */
export function clearPropertyDataCache(address: string): void {
  propertyDataCache.delete(address);
}

/**
 * Compares two coordinate objects to see if they've changed significantly
 */
export function coordsChanged(
  a: { lat: number; lng: number } | null, 
  b: { lat: number; lng: number } | null
): boolean {
  if (!a || !b) return true;
  return Math.abs(a.lat - b.lat) > COORDINATE_THRESHOLD || Math.abs(a.lng - b.lng) > COORDINATE_THRESHOLD;
}

/**
 * Gets cache statistics for debugging
 */
export function getCacheStats(): { addressCacheSize: number; propertyDataCacheSize: number } {
  return {
    addressCacheSize: addressCache.size,
    propertyDataCacheSize: propertyDataCache.size,
  };
} 