import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { logger } from './logger';

/** First and last name from whichever provider signed the user in. */
export function namesFromUser(user: User): { first: string | null; last: string | null } {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const str = (key: string) => {
    const v = meta[key];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  const first = str('first_name') ?? str('given_name');
  const last = str('last_name') ?? str('family_name');
  if (first || last) return { first, last };
  const full = str('full_name') ?? str('name');
  if (!full) return { first: null, last: null };
  const [head, ...rest] = full.split(/\s+/);
  return { first: head, last: rest.join(' ') || null };
}

/** First sign-in (email or social): seed the profile row from the provider's metadata. */
export async function ensureUserProfile(user: User): Promise<void> {
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('first_name')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data?.first_name) return;
    const { first, last } = namesFromUser(user);
    const { error } = await supabase.from('user_profiles').upsert({
      user_id: user.id,
      first_name: first,
      last_name: last,
      phone_number: null,
      contact_preference: 'email',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) logger.error('Error saving profile:', error);
  } catch (error) {
    logger.error('Error saving profile:', error);
  }
}
