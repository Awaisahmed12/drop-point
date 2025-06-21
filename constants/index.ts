// File upload constants
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_FILE_SIZE_MB = 20;

// Map constants
export const US_CENTER = {
  lat: 39.8283, // Geographic center of continental US
  lng: -98.5795,
};

export const DEFAULT_ZOOM = 12;
export const SEARCH_ZOOM = 19;
export const MAP_TYPE_KEY = 'drop-point-map-type';
export const DEFAULT_MAP_TYPE = 'satellite';

// File type constants
export const ACCEPTED_FILE_TYPES = [
  '.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.heic', '.webp', '.gif', '.bmp', '.tiff',
  '.txt', '.csv', '.xls', '.xlsx', '.ppt', '.pptx', '.mp4', '.mov', '.avi', '.mkv',
  '.zip', '.rar', '.7z', '.json', '.xml', '.rtf', '.pages', '.numbers', '.key', '.rcf'
].join(',');

// Coordinate comparison threshold
export const COORDINATE_THRESHOLD = 0.00001;

// Animation durations
export const FLOAT_MESSAGE_DURATION = 2500; // 2.5 seconds 