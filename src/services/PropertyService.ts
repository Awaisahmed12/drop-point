import { logger } from '../utils/logger';
import { supabase } from '../utils/supabaseClient';
import { fileService } from './FileService';
import { folderService } from './FolderService';
import type { Property, PropertyFile, PropertyFolder } from '../../types';

/** The columns every property read asks for: the row plus the ids of its views. */
export const PROPERTY_SELECT = '*, property_tags(tag_id)';

type PropertyRow = Record<string, unknown> & { property_tags?: Array<{ tag_id: string }> | null };

/** Flatten the joined view rows into `tag_ids`. */
export function normalizeProperty<T extends PropertyRow>(row: T): Omit<T, 'property_tags'> & { tag_ids: string[] } {
  const { property_tags, ...rest } = row;
  return { ...rest, tag_ids: (property_tags ?? []).map(t => t.tag_id) };
}

/**
 * Service layer for property-related operations
 * Abstracts Supabase calls to enable testing and reduce coupling
 */
export class PropertyService {
  /**
   * Every property the person can see: their own, plus any carrying a view
   * that was shared with them. Row-level security draws that line.
   */
  async getUserProperties(): Promise<Property[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('properties')
      .select(PROPERTY_SELECT)
      .order('updated_at', { ascending: false });

    if (error) {
      logger.error('[PropertyService] Error fetching user properties:', error);
      throw error;
    }

    return (data || []).map(normalizeProperty) as Property[];
  }

  /**
   * Get a single property by ID
   */
  async getPropertyById(propertyId: string): Promise<Property | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('properties')
      .select(PROPERTY_SELECT)
      .eq('id', propertyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      logger.error('[PropertyService] Error fetching property:', error);
      throw error;
    }

    return data ? (normalizeProperty(data) as Property) : null;
  }

  /**
   * Create a new property
   */
  async createProperty(property: {
    address: string;
    lat: number;
    lng: number;
    label?: string | null;
    notes?: string | null;
  }): Promise<Property> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('properties')
      .insert([{
        user_id: user.id,
        address: property.address,
        lat: property.lat,
        lng: property.lng,
        label: property.label || null,
        notes: property.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      logger.error('[PropertyService] Error creating property:', error);
      throw error;
    }

    if (!data) {
      throw new Error('Property creation failed: No data returned');
    }

    return { ...data, tag_ids: [] };
  }

  /**
   * Update an existing property
   */
  async updateProperty(
    propertyId: string,
    updates: {
      address?: string;
      lat?: number;
      lng?: number;
      label?: string | null;
      notes?: string | null;
    }
  ): Promise<Property> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('properties')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', propertyId)
      .eq('user_id', user.id)
      .select(PROPERTY_SELECT)
      .single();

    if (error) {
      logger.error('[PropertyService] Error updating property:', error);
      throw error;
    }

    if (!data) {
      throw new Error('Property update failed: No data returned');
    }

    return normalizeProperty(data) as Property;
  }

  /**
   * Delete a property and everything on it: the stored files, then the
   * file and folder rows, then the property. Only the owner may.
   */
  async deleteProperty(propertyId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Storage first, so a failure leaves rows that still point at real
    // objects rather than objects nothing points at.
    const bucket = supabase.storage.from('property-files');
    const { data: objects, error: listError } = await bucket.list(propertyId, { limit: 1000 });
    if (listError) {
      logger.error('[PropertyService] Error listing files to delete:', listError);
      throw listError;
    }
    if (objects && objects.length > 0) {
      const { error: removeError } = await bucket.remove(objects.map(o => `${propertyId}/${o.name}`));
      if (removeError) {
        logger.error('[PropertyService] Error deleting stored files:', removeError);
        throw removeError;
      }
    }

    const { error: filesError } = await supabase.from('property_files').delete().eq('property_id', propertyId);
    if (filesError) {
      logger.error('[PropertyService] Error deleting file rows:', filesError);
      throw filesError;
    }
    const { error: foldersError } = await supabase.from('property_folders').delete().eq('property_id', propertyId);
    if (foldersError) {
      logger.error('[PropertyService] Error deleting folder rows:', foldersError);
      throw foldersError;
    }

    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', propertyId)
      .eq('user_id', user.id);

    if (error) {
      logger.error('[PropertyService] Error deleting property:', error);
      throw error;
    }
  }

  /**
   * Get both files and folders for a property. Delegates to FileService /
   * FolderService rather than duplicating the queries — those services
   * are the source of truth for their respective collections (and apply
   * the right RLS-style filters, e.g. folders' deleted_at IS NULL).
   *
   * Previously PropertyService had its own getPropertyFiles and
   * getPropertyFolders that performed the same queries but with slightly
   * different filters (user_id check missing on files, deleted_at filter
   * inconsistent), which was a recipe for subtle bugs as the schema
   * evolves. Consolidated here.
   */
  async getPropertyData(propertyId: string): Promise<{
    files: PropertyFile[];
    folders: PropertyFolder[];
  }> {
    const [files, folders] = await Promise.all([
      fileService.getPropertyFiles(propertyId),
      folderService.getPropertyFolders(propertyId),
    ]);

    return { files, folders };
  }

  /**
   * Verify a property exists and belongs to the user
   */
  async verifyProperty(propertyId: string): Promise<boolean> {
    try {
      const property = await this.getPropertyById(propertyId);
      return property !== null;
    } catch (error) {
      logger.error('[PropertyService] Error verifying property:', error);
      return false;
    }
  }
}

// Export singleton instance
export const propertyService = new PropertyService();

