/**
 * Address parsing utilities for enhanced display
 */

export interface ParsedAddress {
  streetAddress: string;
  locality: string; // City, State, ZIP or equivalent
}

/**
 * Parse a full address into street address and locality components
 * Handles various global address formats
 */
export function parseAddress(fullAddress: string): ParsedAddress {
  if (!fullAddress) {
    return { streetAddress: '', locality: '' };
  }

  // Handle common address patterns
  const parts = fullAddress.split(',').map(part => part.trim());
  
  if (parts.length === 1) {
    // Single part - just return as street address
    return { streetAddress: parts[0], locality: '' };
  }
  
  if (parts.length === 2) {
    // Two parts - first is street, second is locality
    return { streetAddress: parts[0], locality: parts[1] };
  }
  
  if (parts.length >= 3) {
    // Multiple parts - first part is street address, combine rest as locality
    const streetAddress = parts[0];
    const locality = parts.slice(1).join(', ');
    return { streetAddress, locality };
  }
  
  return { streetAddress: fullAddress, locality: '' };
}

/**
 * Format street address for display (limit length if needed)
 */
export function formatStreetAddress(streetAddress: string, maxLength: number = 40): string {
  if (streetAddress.length <= maxLength) {
    return streetAddress;
  }
  return streetAddress.substring(0, maxLength - 3) + '...';
}

/**
 * Format locality for display (city, state, zip)
 */
export function formatLocality(locality: string, maxLength: number = 30): string {
  if (!locality) return '';
  if (locality.length <= maxLength) {
    return locality;
  }
  return locality.substring(0, maxLength - 3) + '...';
} 