import { supabase } from '../utils/supabaseClient';
import type { PropertyFile } from '../../types';
import { sanitizeFileName } from '../../utils/fileManagement';

/**
 * Service layer for file-related operations
 * Abstracts Supabase storage and database calls
 */
export class FileService {
  /**
   * Upload a file to storage
   */
  async uploadFile(
    file: File,
    propertyId: string,
    fileName: string,
    _folderId: string | null = null
  ): Promise<{ path: string }> {
    void _folderId;
    const filePath = `${propertyId}/${fileName}`;
    
    const { data, error } = await supabase.storage
      .from('property-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('[FileService] Error uploading file:', error);
      throw error;
    }

    if (!data) {
      throw new Error('File upload failed: No data returned');
    }

    return { path: data.path };
  }

  /**
   * Create a file record in the database
   */
  async createFileRecord(
    propertyId: string,
    fileName: string,
    filePath: string,
    fileType: string,
    fileSize: number,
    folderId: string | null = null,
    modifiedAt?: string
  ): Promise<PropertyFile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('property_files')
      .insert([{
        property_id: propertyId,
        file_name: fileName,
        file_url: filePath,
        uploaded_at: new Date().toISOString(),
        user_id: user.id,
        file_type: fileType,
        file_size: fileSize,
        folder_id: folderId,
        modified_at: modifiedAt || new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('[FileService] Error creating file record:', error);
      throw error;
    }

    if (!data) {
      throw new Error('File record creation failed: No data returned');
    }

    return data;
  }

  /**
   * Delete a file from storage and database
   */
  async deleteFile(file: PropertyFile): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('property-files')
      .remove([file.file_url]);

    if (storageError) {
      console.error('[FileService] Error deleting file from storage:', storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('property_files')
      .delete()
      .eq('id', file.id)
      .eq('user_id', user.id);

    if (dbError) {
      console.error('[FileService] Error deleting file from database:', dbError);
      throw dbError;
    }
  }

  /**
   * Fetch files for a property
   */
  async getPropertyFiles(propertyId: string): Promise<PropertyFile[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('property_files')
      .select('*')
      .eq('property_id', propertyId)
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('[FileService] Error fetching property files:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Rename a file
   */
  async renameFile(
    file: PropertyFile,
    newName: string
  ): Promise<PropertyFile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const sanitizedNewName = sanitizeFileName(newName);
    if (!sanitizedNewName) {
      throw new Error('Invalid file name after sanitization');
    }

    const oldPath = file.file_url;
    const newPath = `${file.property_id}/${sanitizedNewName}`;

    // Move file in storage
    const { error: moveError } = await supabase.storage
      .from('property-files')
      .move(oldPath, newPath);

    if (moveError) {
      console.error('[FileService] Error moving file in storage:', moveError);
      throw new Error(`Storage error: ${moveError.message}`);
    }

    // Update database record
    const { data, error: dbError } = await supabase
      .from('property_files')
      .update({
        file_name: sanitizedNewName,
        file_url: newPath
      })
      .eq('id', file.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (dbError) {
      console.error('[FileService] Error updating file record:', dbError);
      throw dbError;
    }

    if (!data) {
      throw new Error('File rename failed: No data returned');
    }

    return data;
  }

  /**
   * Move a file to a different folder
   * If newFileName is provided, the file will be renamed during the move
   */
  async moveFile(
    file: PropertyFile,
    targetFolderId: string | null,
    newFileName?: string
  ): Promise<PropertyFile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    let finalFileName = file.file_name;
    let finalPath = file.file_url;

    // If file name needs to change, rename in storage
    if (newFileName && newFileName !== file.file_name) {
      const oldPath = `${file.property_id}/${file.file_name}`;
      const newPath = `${file.property_id}/${newFileName}`;

      // Copy to new location
      const { error: copyError } = await supabase.storage
        .from('property-files')
        .copy(oldPath, newPath);

      if (copyError) {
        console.error('[FileService] Error copying file:', copyError);
        throw new Error(`Storage error: ${copyError.message}`);
      }

      // Remove old file
      const { error: removeError } = await supabase.storage
        .from('property-files')
        .remove([oldPath]);

      if (removeError) {
        console.warn('[FileService] Warning removing old file:', removeError);
        // Continue anyway
      }

      finalFileName = newFileName;
      finalPath = newPath;
    }

    // Update database record
    const { data, error: dbError } = await supabase
      .from('property_files')
      .update({
        folder_id: targetFolderId,
        file_name: finalFileName,
        file_url: finalPath
      })
      .eq('id', file.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (dbError) {
      console.error('[FileService] Error updating file record:', dbError);
      throw dbError;
    }

    if (!data) {
      throw new Error('File move failed: No data returned');
    }

    return data;
  }

  /**
   * Duplicate a file in place: server-side storage copy (no re-upload of
   * bytes — fast even for big files) plus a new property_files row that
   * points at the copy.
   *
   * The caller is responsible for picking a non-colliding destination name
   * (use getDuplicateFileName from utils/fileManagement). We pass the
   * fully-resolved name in instead of generating it here, because the
   * caller has the already-fetched files list.
   */
  async copyFile(file: PropertyFile, newFileName: string): Promise<PropertyFile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const sanitized = sanitizeFileName(newFileName);
    if (!sanitized) {
      throw new Error('Invalid duplicate file name after sanitization');
    }

    const oldPath = file.file_url;
    const newPath = `${file.property_id}/${sanitized}`;

    // Server-side copy in storage. If the destination path already exists,
    // Supabase returns an error — caller should have resolved the conflict
    // via getDuplicateFileName before calling.
    const { error: copyError } = await supabase.storage
      .from('property-files')
      .copy(oldPath, newPath);

    if (copyError) {
      console.error('[FileService] Error copying file in storage:', copyError);
      throw new Error(`Storage error: ${copyError.message}`);
    }

    // Insert a new DB row for the duplicate. Resets uploaded_at/modified_at
    // to "now" so sorting by date surfaces the duplicate as the newest file
    // (which matches Finder/Explorer behavior).
    const now = new Date().toISOString();
    const { data, error: dbError } = await supabase
      .from('property_files')
      .insert([{
        property_id: file.property_id,
        folder_id: file.folder_id,
        user_id: user.id,
        file_name: sanitized,
        file_url: newPath,
        file_type: file.file_type,
        file_size: file.file_size,
        uploaded_at: now,
        modified_at: now,
      }])
      .select()
      .single();

    if (dbError) {
      // Storage copy succeeded but DB insert failed — best-effort rollback
      // so we don't leave an orphaned blob lying around.
      console.error('[FileService] Error creating duplicate record, rolling back storage copy:', dbError);
      await supabase.storage.from('property-files').remove([newPath]).catch(() => {});
      throw dbError;
    }

    if (!data) {
      throw new Error('File duplication failed: No data returned');
    }

    return data;
  }

  /**
   * Get files in a specific folder
   */
  async getFilesInFolder(
    propertyId: string,
    folderId: string | null
  ): Promise<PropertyFile[]> {
    const { data, error } = await supabase
      .from('property_files')
      .select('*')
      .eq('property_id', propertyId)
      .eq('folder_id', folderId || null)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('[FileService] Error fetching files in folder:', error);
      throw error;
    }

    return data || [];
  }
}

// Export singleton instance
export const fileService = new FileService();

