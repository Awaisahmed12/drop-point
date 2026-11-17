import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn<() => Promise<{ id: string; token: string } | null>>(),
  rateLimit: vi.fn<() => boolean>(() => true),
}));
vi.mock('../../utils/apiGuard', () => ({
  requireUser: mocks.requireUser,
  rateLimit: mocks.rateLimit,
  googleMapsServerKey: () => 'server-key',
}));

import handler from './reverse-geocode';

const run = async (query: Record<string, string>, method = 'GET') => {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    setHeader() {},
  };
  await handler({ method, query, headers: {} } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res;
};

describe('/api/reverse-geocode', () => {
  beforeEach(() => {
    mocks.requireUser.mockReset();
    mocks.rateLimit.mockReset().mockReturnValue(true);
    vi.unstubAllGlobals();
  });

  it('rejects coordinates that are not coordinates before touching auth or Google', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    for (const query of [{ lat: '91', lng: '0' }, { lat: '1', lng: '181' }, { lat: '1&key=x', lng: '2' }, { lat: '', lng: '' }, { lng: '2' }]) {
      const res = await run(query);
      expect(res.statusCode, JSON.stringify(query)).toBe(400);
    }
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses anonymous callers', async () => {
    mocks.requireUser.mockImplementation(async () => null);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await run({ lat: '29.6', lng: '-95.7' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('stops at the rate limit', async () => {
    mocks.requireUser.mockResolvedValue({ id: 'u1', token: 't' });
    mocks.rateLimit.mockReturnValue(false);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await run({ lat: '29.6', lng: '-95.7' });
    expect(mocks.rateLimit).toHaveBeenCalledWith(expect.anything(), 'geocode:u1', 60, 60_000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls Google with the server key and the parsed coordinates, and never echoes its error text', async () => {
    mocks.requireUser.mockResolvedValue({ id: 'u1', token: 't' });
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: 'REQUEST_DENIED', error_message: 'API key restricted to referrer X' }),
    }));
    vi.stubGlobal('fetch', fetchSpy);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await run({ lat: '29.6', lng: '-95.7' });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain('latlng=29.6%2C-95.7');
    expect(url).toContain('key=server-key');
    expect(res.statusCode).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain('referrer');
  });

  it('only answers GET', async () => {
    const res = await run({ lat: '1', lng: '2' }, 'POST');
    expect(res.statusCode).toBe(405);
  });
});
