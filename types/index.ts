// Property type matching the properties table
export type Property = {
  id: string | null;
  user_id?: string;
  address: string;
  lat: number;
  lng: number;
  user_selected_lat?: number;
  user_selected_lng?: number;
  label?: string | null;
  notes?: string | null;
  thumbnail_url?: string | null;
  /** Ids of the views (tags) this property carries. */
  tag_ids?: string[];
};

// Who may see a file or folder: its uploader only, or everyone who can see
// the property (the owner and members of any view it carries).
export type Visibility = 'private' | 'shared';

// A view: a named, colored label owned by one person (the `tags` table).
// Put on properties to group them; shared with people to collaborate.
export type Tag = {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  created_at?: string;
  updated_at?: string;
  /** Only the owner sees the full list; a member sees their own row. */
  members?: TagMember[];
};

export type TagRole = 'viewer' | 'editor';

export type TagMember = {
  id: string;
  tag_id: string;
  email: string;
  /** Null until the invited person signs in. */
  user_id: string | null;
  role: TagRole;
  created_at?: string;
};

// Property with file count for list views and property switching
export type PropertyWithFileCount = Property & {
  file_count: number;
  last_accessed?: string;
  created_at?: string;
  updated_at?: string;
};

// PropertyFile type matching the property_files table
export type PropertyFile = {
  id: string;
  property_id: string;
  folder_id: string | null;
  file_name: string;
  file_url: string;
  uploaded_at: string;
  user_id: string;
  file_type: string;
  file_size: number;
  modified_at?: string;
  /** Private to the uploader unless 'shared'. Missing on rows from before the migration = private. */
  visibility?: Visibility;
};

// Prediction type for Google Places API
export type Prediction = { 
  description: string; 
  place_id: string; 
  matched_substrings?: unknown; 
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  }; 
  terms?: unknown; 
  types?: string[];
  // User property specific fields
  user_property?: boolean;
  property_id?: string;
  isUserProperty?: boolean;
  // Enhanced display fields
  displayText?: string;
  secondaryText?: string;
};

// Upload file status type
export type UploadFileStatus = {
  name: string;
  status: 'uploading' | 'success' | 'error';
  error?: string;
};

// Rejected file type
export type RejectedFile = {
  name: string;
  size: number;
};

// Float message type
export type FloatMessage = {
  text: string;
  type: 'success' | 'error';
};

// Folder type matching the property_folders table
export type PropertyFolder = {
  id: string;
  property_id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** Private to its creator unless 'shared'. Uploads inherit the folder's setting. */
  visibility?: Visibility;
};

// PendingUpload interface for file upload tracking
export interface PendingUpload {
  id: string;
  file: File;
  name: string;
  status: 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  folder_id: string | null;
  property_id: string;
  retry?: () => void;
  cancel?: () => void;
  abortController?: AbortController;
}

// Map rendering mode. 'hybrid' is satellite imagery with labels; it is what
// the UI calls "Satellite".
export type MapType = 'roadmap' | 'hybrid';

// Sort field type
export type SortField = 'name' | 'date' | 'size';
export type SortDirection = 'asc' | 'desc';

// Admin Configuration types
export type AdminConfiguration = {
  id: string;
  key: string;
  // JSONB column — shape varies per config key. Consumers must narrow at the
  // call site (e.g. via a typed getValue<T>(key, fallback) helper). `unknown`
  // forces that narrowing instead of letting `any` propagate quietly.
  value: unknown;
  description?: string;
  category: string;
  is_active: boolean;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
};

// Specific configuration types
export type StreetViewConfig = {
  enabled: boolean;
};

// Configuration categories
export type ConfigCategory = 'ui' | 'performance' | 'features' | 'general'; 