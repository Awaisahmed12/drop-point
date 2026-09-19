import { logger } from '../utils/logger';
import { supabase } from '../utils/supabaseClient';
import type { Tag, TagMember, TagRole } from '../../types';

/**
 * Views (the `tags` table), the properties they sit on, and the people they
 * are shared with. Thin wrapper over Supabase; row-level security decides
 * what each call may touch.
 */
export class TagService {
  /** Every view the person owns or has been given, with members where visible. */
  async getTags(): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*, members:tag_members(*)')
      .order('name', { ascending: true });
    if (error) {
      logger.error('[TagService] Error fetching views:', error);
      throw error;
    }
    return (data ?? []) as Tag[];
  }

  async createTag(name: string, color: string): Promise<Tag> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('tags')
      .insert([{ owner_id: user.id, name, color }])
      .select('*, members:tag_members(*)')
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('DUPLICATE_TAG');
      logger.error('[TagService] Error creating view:', error);
      throw error;
    }
    return data as Tag;
  }

  async updateTag(tagId: string, updates: { name?: string; color?: string }): Promise<Tag> {
    const { data, error } = await supabase
      .from('tags')
      .update(updates)
      .eq('id', tagId)
      .select('*, members:tag_members(*)')
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('DUPLICATE_TAG');
      logger.error('[TagService] Error updating view:', error);
      throw error;
    }
    return data as Tag;
  }

  async deleteTag(tagId: string): Promise<void> {
    const { error } = await supabase.from('tags').delete().eq('id', tagId);
    if (error) {
      logger.error('[TagService] Error deleting view:', error);
      throw error;
    }
  }

  /** Leave a view someone else shared. */
  async leaveTag(tagId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const { error } = await supabase.from('tag_members').delete().eq('tag_id', tagId).eq('user_id', user.id);
    if (error) {
      logger.error('[TagService] Error leaving view:', error);
      throw error;
    }
  }

  /** Replace the set of views on a property. Only its owner may do this. */
  async setPropertyTags(propertyId: string, tagIds: string[]): Promise<string[]> {
    const { data: current, error: readError } = await supabase
      .from('property_tags')
      .select('tag_id')
      .eq('property_id', propertyId);
    if (readError) {
      logger.error('[TagService] Error reading property views:', readError);
      throw readError;
    }
    const have = new Set((current ?? []).map(r => r.tag_id as string));
    const want = new Set(tagIds);
    const toAdd = tagIds.filter(id => !have.has(id));
    const toRemove = [...have].filter(id => !want.has(id));

    if (toAdd.length > 0) {
      const { error } = await supabase
        .from('property_tags')
        .insert(toAdd.map(tag_id => ({ property_id: propertyId, tag_id })));
      if (error) {
        logger.error('[TagService] Error adding views to property:', error);
        throw error;
      }
    }
    if (toRemove.length > 0) {
      const { error } = await supabase
        .from('property_tags')
        .delete()
        .eq('property_id', propertyId)
        .in('tag_id', toRemove);
      if (error) {
        logger.error('[TagService] Error removing views from property:', error);
        throw error;
      }
    }
    return tagIds;
  }

  async addMember(tagId: string, email: string, role: TagRole): Promise<TagMember> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('tag_members')
      .insert([{ tag_id: tagId, email, role, invited_by: user.id }])
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('DUPLICATE_MEMBER');
      logger.error('[TagService] Error sharing view:', error);
      throw error;
    }
    return data as TagMember;
  }

  async updateMemberRole(memberId: string, role: TagRole): Promise<TagMember> {
    const { data, error } = await supabase
      .from('tag_members')
      .update({ role })
      .eq('id', memberId)
      .select()
      .single();
    if (error) {
      logger.error('[TagService] Error changing member role:', error);
      throw error;
    }
    return data as TagMember;
  }

  async removeMember(memberId: string): Promise<void> {
    const { error } = await supabase.from('tag_members').delete().eq('id', memberId);
    if (error) {
      logger.error('[TagService] Error removing member:', error);
      throw error;
    }
  }

  /** Bind invites addressed to the signed-in email to this account. Safe to repeat. */
  async claimInvites(): Promise<void> {
    const { error } = await supabase.rpc('claim_tag_invites');
    // The migration may not be applied yet; that is not an error for the app.
    if (error) logger.warn('[TagService] Could not claim invites:', error.message);
  }
}

export const tagService = new TagService();
