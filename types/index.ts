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
};

// Prediction type for Google Places API
export type Prediction = { 
  description: string; 
  place_id: string; 
  matched_substrings?: unknown; 
  structured_formatting?: unknown; 
  terms?: unknown; 
  types?: string[] 
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
}

// Sort field type
export type SortField = 'name' | 'date' | 'size';
export type SortDirection = 'asc' | 'desc'; 