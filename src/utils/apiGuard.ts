import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Guards for the API routes. Server-side only: never import from a page.
 *
 * Every route that spends a third-party quota (Google Maps) requires a
 * signed-in user, so an anonymous script cannot run up the bill, and is
 * rate-limited per user on top of that.
 */

const anonClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/**
 * The signed-in user behind `Authorization: Bearer <access token>`, or
 * null after answering 401. The token is verified with Supabase, not just
 * decoded, so a forged or expired one is refused.
 */
export async function requireUser(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<{ id: string; token: string } | null> {
  const header = req.headers.authorization;
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Sign in to use this.' });
    return null;
  }
  try {
    const { data: { user }, error } = await anonClient().auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: 'Your session has expired. Sign in again.' });
      return null;
    }
    return { id: user.id, token };
  } catch {
    res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    return null;
  }
}

// Fixed windows per key, in this process's memory. On Vercel that is per
// serverless instance, which is enough to stop one account hammering a
// route; a shared store (Upstash, Vercel KV) would make it global.
const windows = new Map<string, { count: number; resetAt: number }>();
const MAX_TRACKED_KEYS = 5000;

/**
 * Allow `limit` requests per `windowMs` for `key` (normally the user id).
 * Answers 429 with Retry-After and returns false once the limit is hit.
 */
export function rateLimit(res: NextApiResponse, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  let entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) {
      for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
      if (windows.size >= MAX_TRACKED_KEYS) windows.clear();
    }
    entry = { count: 0, resetAt: now + windowMs };
    windows.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > limit) {
    res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    res.status(429).json({ error: 'Too many requests. Try again in a moment.' });
    return false;
  }
  return true;
}

/** Test hook: forget every window. */
export function resetRateLimits(): void {
  windows.clear();
}

/**
 * The Google Maps key the server calls with. A separate, IP- or
 * API-restricted key when one is set; otherwise the browser key, which must
 * then allow server calls as well.
 */
export const googleMapsServerKey = (): string | undefined =>
  process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
