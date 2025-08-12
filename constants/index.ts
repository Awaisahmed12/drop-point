import type { Libraries } from '@react-google-maps/api';

// Map configuration constants
export const containerStyle = {
  width: '100vw',
  height: '100vh',
};

export const US_CENTER = {
  lat: 39.8283, // Geographic center of continental US
  lng: -98.5795,
};

export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
export const GOOGLE_MAP_LIBRARIES = ["places"] as Libraries;

export const DEFAULT_ZOOM = 14; // Lower than recenter zoom (17) so first click zooms in to closer level
export const SEARCH_ZOOM = 17; // slightly wider on mobile for context
// Friendlier zoom level when jumping to current location (neighborhood view)
export const CURRENT_LOCATION_ZOOM = 17;
// Closer follow-up zoom for current location (street-level but not max)
export const CURRENT_LOCATION_ZOOM_DEEP = 19;
export const PROPERTY_SELECTION_MIN_ZOOM = 18; // Minimum zoom to show property selection card
// Map configuration
export const MAP_TYPE_KEY = 'droppoint-map-type';
export const DEFAULT_MAP_TYPE = 'hybrid';

// Coordinate comparison threshold
export const COORDINATE_THRESHOLD = 0.00001;

// File upload constants
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_FILE_SIZE_MB = 50;

export const ACCEPTED_FILE_TYPES = [
  '.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.heic', '.webp', '.gif', '.bmp', '.tiff',
  '.txt', '.csv', '.xls', '.xlsx', '.ppt', '.pptx', '.mp4', '.mov', '.avi', '.mkv',
  '.zip', '.rar', '.7z', '.json', '.xml', '.rtf', '.pages', '.numbers', '.key', '.rcf'
].join(',');

export const SUPPORTED_FILE_TYPES = [
  'image/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/*',
  'video/*',
  'audio/*',
];

// Monetization: Free tier quota (bytes)
export const FREE_TIER_GB = Number(process.env.NEXT_PUBLIC_FREE_TIER_GB ?? '5');
export const FREE_TIER_MAX_BYTES = FREE_TIER_GB * 1024 * 1024 * 1024; // default 5 GB, configurable via env

// Google Drive-inspired color map for file types
export const fileTypeColorMap: Record<string, string> = {
  doc: '#1a73e8', // Google blue
  docx: '#1a73e8',
  xls: '#188038', // Google green
  xlsx: '#188038',
  csv: '#188038',
  ppt: '#e37400', // Google orange
  pptx: '#e37400',
  pdf: '#d93025', // Google red
  png: '#d93025', // Google red for images
  jpg: '#d93025',
  jpeg: '#d93025',
  gif: '#d93025',
  webp: '#d93025',
  mp4: '#a142f4', // Google purple
  mov: '#a142f4',
  avi: '#a142f4',
  webm: '#a142f4',
};

// Animation durations
export const FLOAT_MESSAGE_DURATION = 2500; // 2.5 seconds 