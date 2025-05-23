import { describe, it, expect, vi } from 'vitest';
import * as supabaseJs from '@supabase/supabase-js';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ mocked: true })),
}));

describe('supabaseClient', () => {
  it('should create a client with the correct URL and anon key', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    // Re-import to use new env vars
    const { supabase } = await import('./supabaseClient');
    expect(supabaseJs.createClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-anon-key');
    expect(supabase).toEqual({ mocked: true });
  });
}); 