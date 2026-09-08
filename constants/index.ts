import type { Libraries } from '@react-google-maps/api';
import type { MapType } from '../types';

// The map fills its flex parent (sidebar layout)
export const mapContainerStyleWithSidebar = {
  width: '100%',
  height: '100%',
};

export const US_CENTER = {
  lat: 39.8283, // Geographic center of continental US
  lng: -98.5795,
};

export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

// Connectors. Each is off until its env var is set, so nothing shows a
// button that can't work.
export type AuthProvider = 'google' | 'apple' | 'facebook';
/** Social sign-in buttons to offer, from NEXT_PUBLIC_AUTH_PROVIDERS="google,apple,facebook". */
export const AUTH_PROVIDERS: AuthProvider[] = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? '')
  .split(',')
  .map(p => p.trim().toLowerCase())
  .filter((p): p is AuthProvider => p === 'google' || p === 'apple' || p === 'facebook');
/** Google Cloud OAuth web client id used by the Drive picker. Empty = no Drive import. */
export const GOOGLE_OAUTH_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? '';
/** API key for Google Picker; the Maps key works once the Picker API is enabled on it. */
export const GOOGLE_PICKER_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
export const GOOGLE_MAP_LIBRARIES = ["places"] as Libraries;

export const DEFAULT_ZOOM = 14; // Lower than recenter zoom (17) so first click zooms in to closer level
export const SEARCH_ZOOM = 17; // slightly wider on mobile for context
// Friendlier zoom level when jumping to current location (neighborhood view)
export const CURRENT_LOCATION_ZOOM = 17;
// Closer follow-up zoom for current location (street-level but not max)
export const CURRENT_LOCATION_ZOOM_DEEP = 19;
// Persisted map preferences
export const MAP_TYPE_KEY = 'droppoint-map-type';
export const MAP_POSITION_KEY = 'droppoint-map-position';
// Two choices only (Hick's Law): a plain map, or satellite imagery with labels.
export const DEFAULT_MAP_TYPE: MapType = 'hybrid';

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

// Search / autocomplete
// Debounce window for map search autocomplete requests. Keeps us from hitting the
// Google Places quota on every keystroke and prevents stale responses from racing
// the latest one. Pair with AbortController-based cancellation in MapSearch.
export const AUTOCOMPLETE_DEBOUNCE_MS = 200;

// Auth flow: after a successful login, hold the "Welcome back!" spinner for this
// many ms before navigating to /map. Purely cosmetic; long enough to register as
// a confirmation, short enough not to feel slow.
export const POST_LOGIN_SPINNER_MS = 1200;

// Toast auto-dismiss timeouts. Errors stay longer because they're easier to miss
// and the user may need a moment to read them.
export const TOAST_SUCCESS_MS = 3000;
export const TOAST_ERROR_MS = 5000;

// FileThumbnail batches signed-URL requests across all mounted thumbnails so the
// Supabase storage API gets one call instead of N. THUMBNAIL_BATCH_WINDOW_MS is
// the time we wait after the first queued request before flushing — anything
// queued in that window joins the same batch. BATCH_MAX caps each call (Supabase
// has its own per-request limit; 100 is well under it and keeps payloads small).
export const THUMBNAIL_BATCH_WINDOW_MS = 80;
export const THUMBNAIL_BATCH_MAX = 100;

// Storage signed-URL expiry. 3600s = 1 hour. Long enough that the URL embedded
// in an inline-viewer iframe stays valid for a normal reading session, short
// enough that a leaked URL has limited reuse.
export const SIGNED_URL_EXPIRY_SEC = 3600;

// In-memory cache TTL for the user's property list and property data prefetch.
// 5 minutes balances UI snappiness (avoid re-querying on every tab switch) with
// staleness (recent uploads / new properties surface quickly).
export const PROPERTY_CACHE_TTL_MS = 5 * 60 * 1000;

// Text color standards - Ensure proper contrast for accessibility
// These correspond to Tailwind classes but serve as documentation
export const TEXT_COLORS = {
  // Primary text colors (high contrast on white/light backgrounds)
  PRIMARY: 'text-gray-900',        // Main text - highest contrast
  SECONDARY: 'text-gray-700',     // Secondary text - good contrast
  TERTIARY: 'text-gray-500',      // Tertiary text - medium contrast
  MUTED: 'text-gray-400',         // Muted text - lower contrast (use sparingly)
  
  // Placeholder colors (must have sufficient contrast)
  PLACEHOLDER: 'text-gray-500',   // Input placeholders - MUST be visible
  PLACEHOLDER_LIGHT: 'text-gray-400', // Light placeholders (use with caution)
  
  // Interactive states
  LINK: 'text-blue-600',
  LINK_HOVER: 'text-blue-700',
  ERROR: 'text-red-600',
  SUCCESS: 'text-green-600',
  WARNING: 'text-yellow-600',
} as const;

// Standardized input classes to prevent contrast issues
export const INPUT_CLASSES = {
  BASE: 'text-gray-900 placeholder:text-gray-500',
  MOBILE: 'text-base text-gray-900 placeholder:text-gray-500',
  DESKTOP: 'text-sm text-gray-900 placeholder:text-gray-500',
} as const;