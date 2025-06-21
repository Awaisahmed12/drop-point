// Coordinate validation
export function isValidLatitude(lat: number): boolean {
  return lat >= -90 && lat <= 90;
}

export function isValidLongitude(lng: number): boolean {
  return lng >= -180 && lng <= 180;
}

export function isValidCoordinates(lat: number, lng: number): boolean {
  return isValidLatitude(lat) && isValidLongitude(lng);
}

// File validation
export function isValidFileName(fileName: string): boolean {
  // Check for invalid characters in file names
  const invalidChars = /[<>:"/\\|?*]/;
  return !invalidChars.test(fileName) && fileName.length > 0 && fileName.length <= 255;
}

export function isValidFileSize(fileSize: number, maxSize: number): boolean {
  return fileSize > 0 && fileSize <= maxSize;
}

export function getFileExtension(fileName: string): string | null {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : null;
}

// Address validation
export function isValidAddress(address: string): boolean {
  return address.trim().length > 0 && address.trim().length <= 500;
}

// Property validation
export function isValidProperty(property: {
  address: string;
  lat: number;
  lng: number;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!isValidAddress(property.address)) {
    errors.push('Invalid address');
  }
  
  if (!isValidCoordinates(property.lat, property.lng)) {
    errors.push('Invalid coordinates');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
} 