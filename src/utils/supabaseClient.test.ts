import { describe, it, expect, vi } from 'vitest';
import * as supabaseJs from '@supabase/supabase-js';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ mocked: true })),
}));

describe('supabaseClient', () => {
  it('creates a client with the configured URL, anon key, and auth options', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

    // Dynamic import after env vars are set so module-level reads pick them up.
    const { supabase } = await import('./supabaseClient');

    // Verify URL + key without over-constraining the auth options object;
    // exact shape is verified via objectContaining so adding a new auth
    // flag later doesn't break the test.
    expect(supabaseJs.createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        }),
      }),
    );
    expect(supabase).toEqual({ mocked: true });
  });
});
