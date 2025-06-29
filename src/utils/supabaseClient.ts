import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
      .createSignedUrl(filePath, 3600, { 
        download: true
      });
    
    if (error) {
      console.error('Error creating download URL:', error);
      throw error;
    }
    
    return data.signedUrl;
  } else {
    // For inline viewing, try signed URL without download flag first
    const { data, error } = await supabase.storage
      .from('property-files')
      .createSignedUrl(filePath, 3600);
    
    if (error) {
      console.error('Error creating signed URL:', error);
      throw error;
    }
    
    return data.signedUrl;
  }
};