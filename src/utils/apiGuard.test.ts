import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextApiResponse } from 'next';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn<(token: string) => Promise<{ data: { user: { id: string } | null }; error: Error | null }>>(),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: mocks.getUser } }),
}));

import { rateLimit, requireUser, resetRateLimits, googleMapsServerKey } from './apiGuard';

const fakeRes = () => {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    setHeader(name: string, value: string) { this.headers[name] = value; },
  };
  return res as unknown as NextApiResponse & typeof res;
};

describe('requireUser', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
    mocks.getUser.mockReset();
  });

  it('answers 401 without a bearer token and never calls Supabase', async () => {
    const res = fakeRes();
    const user = await requireUser({ headers: {} } as never, res);
    expect(user).toBeNull();
    expect(res.statusCode).toBe(401);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('answers 401 when Supabase rejects the token', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });
    const res = fakeRes();
    const user = await requireUser({ headers: { authorization: 'Bearer forged' } } as never, res);
    expect(user).toBeNull();
    expect(res.statusCode).toBe(401);
  });

  it('returns the verified user and the token it verified', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const res = fakeRes();
    const user = await requireUser({ headers: { authorization: 'Bearer good' } } as never, res);
    expect(user).toEqual({ id: 'u1', token: 'good' });
    expect(mocks.getUser).toHaveBeenCalledWith('good');
    expect(res.statusCode).toBe(200);
  });
});

describe('rateLimit', () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('allows up to the limit in a window, then answers 429 with Retry-After', () => {
    for (let i = 0; i < 3; i++) expect(rateLimit(fakeRes(), 'k', 3, 60_000)).toBe(true);
    const res = fakeRes();
    expect(rateLimit(res, 'k', 3, 60_000)).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(Number(res.headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('keeps keys apart and opens a fresh window after it expires', () => {
    for (let i = 0; i < 3; i++) rateLimit(fakeRes(), 'a', 3, 60_000);
    expect(rateLimit(fakeRes(), 'b', 3, 60_000)).toBe(true);
    expect(rateLimit(fakeRes(), 'a', 3, 60_000)).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(rateLimit(fakeRes(), 'a', 3, 60_000)).toBe(true);
  });
});

describe('googleMapsServerKey', () => {
  it('prefers a server-only key over the browser key', () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'browser');
    vi.stubEnv('GOOGLE_MAPS_SERVER_API_KEY', 'server');
    expect(googleMapsServerKey()).toBe('server');
    vi.stubEnv('GOOGLE_MAPS_SERVER_API_KEY', '');
    expect(googleMapsServerKey()).toBe('browser');
  });
});
