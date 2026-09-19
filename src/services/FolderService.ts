import { logger } from '../utils/logger';
import { supabase } from '../utils/supabaseClient';
import type { PropertyFolder, Visibility } from '../../types';

/**
 * Service layer for folder-related operations
 * Abstracts Supabase database calls
 */
export class FolderService {
  /**
   * Create a new folder
   */
  async createFolder(
    propertyId: string,
    name: string,
    parentId: string | null = null,
    visibility: Visibility = 'private'
  ): Promise<PropertyFolder> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Sanitize folder name
    const sanitizedName = name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50).trim();
    if (!sanitizedName) {
      throw new Error('Invalid folder name');
    }

    const { data, error } = await supabase
      .from('property_folders')
      .insert([{
        property_id: propertyId,
        user_id: user.id,
        name: sanitizedName,
        parent_id: parentId,
        visibility,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique')) {
        throw new Error('DUPLICATE_FOLDER');
      }
      logger.error('[FolderService] Error creating folder:', error);
      throw error;
    }

    if (!data) {
      throw new Error('Folder creation failed: No data returned');
    }

    return data;
  }

  /**
   * Create folder with automatic unique naming if duplicate exists
   */
  async createFolderWithUniqueName(
    propertyId: string,
    baseName: string,
    parentId: string | null = null,
    existingFolders: PropertyFolder[] = []
  ): Promise<PropertyFolder> {
    const sanitizedName = baseName.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50).trim();
    if (!sanitizedName) {
      throw new Error('Invalid folder name');
    }

    // Check for existing folder with same name
    const existingFolder = existingFolders.find(
      f => f.parent_id === parentId && f.name.toLowerCase() === sanitizedName.toLowerCase()
    );

    if (!existingFolder) {
      // No conflict, create with original name
      return this.createFolder(propertyId, sanitizedName, parentId);
    }

    // Conflict exists, try with suffix
    let suffix = 1;
    let nameToTry = `${sanitizedName} (${suffix})`;
    let maxAttempts = 10;

    while (maxAttempts > 0) {
      const conflict = existingFolders.find(
        f => f.parent_id === parentId && f.name.toLowerCase() === nameToTry.toLowerCase()
      );

      if (!conflict) {
        // Found unique name
        return this.createFolder(propertyId, nameToTry, parentId);
      }

      suffix++;
      nameToTry = `${sanitizedName} (${suffix})`;
      maxAttempts--;
    }

    throw new Error('Could not find a unique folder name after many attempts');
  }

  /**
   * Delete a folder
   */
  async deleteFolder(folderId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Soft delete by setting deleted_at timestamp. Row-level security lets
    // the creator and the property's owner through.
    const { error } = await supabase
      .from('property_folders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', folderId);

    if (error) {
      logger.error('[FolderService] Error deleting folder:', error);
      throw error;
    }
  }

  /**
   * Rename a folder
   */
  async renameFolder(
    folder: PropertyFolder,
    newName: string
  ): Promise<PropertyFolder> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Sanitize folder name
    const sanitizedName = newName.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50).trim();
    if (!sanitizedName) {
      throw new Error('Invalid folder name');
    }

    const { data, error } = await supabase
      .from('property_folders')
      .update({ name: sanitizedName })
      .eq('id', folder.id)
      .select()
      .single();

    if (error) {
      logger.error('[FolderService] Error renaming folder:', error);
      throw error;
    }

    if (!data) {
      throw new Error('Folder rename failed: No data returned');
    }

    return data;
  }

  /**
   * Share a folder with everyone who can see the property, or make it
   * private again. Sharing also opens the folders above it so it can be
   * reached; both directions apply to everything inside it. Done in one
   * database call (set_folder_visibility) so a half-applied change can't
   * leave a shared file in a private folder.
   */
  async setVisibility(folderId: string, visibility: Visibility): Promise<void> {
    const { error } = await supabase.rpc('set_folder_visibility', {
      p_folder: folderId,
      p_visibility: visibility,
      p_include_contents: true,
    });
    if (error) {
      logger.error('[FolderService] Error changing folder visibility:', error);
      throw error;
    }
  }

  /**
   * The folders of a property this person may see: their own plus shared
   * ones (row-level security).
   */
  async getPropertyFolders(propertyId: string): Promise<PropertyFolder[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('property_folders')
      .select('*')
      .eq('property_id', propertyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('[FolderService] Error fetching folders:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Check if folder name already exists in parent
   */
  async folderNameExists(
    propertyId: string,
    name: string,
    parentId: string | null,
    excludeFolderId?: string
  ): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    let query = supabase
      .from('property_folders')
      .select('id')
      .eq('property_id', propertyId)
      .eq('name', name)
      .eq('parent_id', parentId || null)
      .is('deleted_at', null);

    if (excludeFolderId) {
      query = query.neq('id', excludeFolderId);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      logger.error('[FolderService] Error checking folder name:', error);
      return false; // Assume doesn't exist on error
    }

    return (data?.length || 0) > 0;
  }
}

// Export singleton instance
export const folderService = new FolderService();

