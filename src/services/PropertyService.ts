import { logger } from '../utils/logger';
import { supabase } from '../utils/supabaseClient';
import { fileService } from './FileService';
import { folderService } from './FolderService';
import type { Property, PropertyFile, PropertyFolder } from '../../types';

/**
 * Service layer for property-related operations
 * Abstracts Supabase calls to enable testing and reduce coupling
 */
export class PropertyService {
  /**
   * Get all properties for the current user
   */
  async getUserProperties(): Promise<Property[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      logger.error('[PropertyService] Error fetching user properties:', error);
      throw error;
    }

    return data || [];
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
      .select('*')
      .eq('id', propertyId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      logger.error('[PropertyService] Error fetching property:', error);
      throw error;
    }

    return data;
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

    return data;
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
      .select()
      .single();

    if (error) {
      logger.error('[PropertyService] Error updating property:', error);
      throw error;
    }

    if (!data) {
      throw new Error('Property update failed: No data returned');
    }

    return data;
  }

  /**
   * Delete a property
   */
  async deleteProperty(propertyId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
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

