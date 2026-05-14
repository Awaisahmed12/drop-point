import { logger } from './logger';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { SIGNED_URL_EXPIRY_SEC } from '../../constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Robust persistent auth on the client
const storage: SupportedStorage | undefined =
  typeof window !== 'undefined' ? window.localStorage : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage,
  },
});

export const getSiteUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl && typeof envUrl === 'string') return envUrl.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '');
  return '';
};

// Utility function to get a secure signed URL for a file (expires in 1 hour)
export const getFileSignedUrl = async (
  propertyId: string, 
  fileName: string, 
  download: boolean = false
): Promise<string> => {
  const filePath = `${propertyId}/${fileName}`;
  
  if (download) {
    // For downloads, use signed URL with download flag
    const { data, error } = await supabase.storage
      .from('property-files')
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY_SEC, { 
        download: true
      });
    
    if (error) {
      logger.error('Error creating download URL:', error);
      throw error;
    }
    
    return data.signedUrl;
  } else {
    // For inline viewing, try signed URL without download flag first
    const { data, error } = await supabase.storage
      .from('property-files')
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY_SEC);
    
    if (error) {
      logger.error('Error creating signed URL:', error);
      throw error;
    }
    
    return data.signedUrl;
  }
};
