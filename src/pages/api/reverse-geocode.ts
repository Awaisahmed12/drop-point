import type { NextApiRequest, NextApiResponse } from 'next';
import { googleMapsServerKey, rateLimit, requireUser } from '../../utils/apiGuard';

const inRange = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== 'string' || !/^-?\d{1,3}(\.\d{1,12})?$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
};

/**
 * Reverse-geocode a coordinate through Google, keeping the key on the
 * server. Signed-in users only, 60 lookups a minute each.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const lat = inRange(req.query.lat, -90, 90);
  const lng = inRange(req.query.lng, -180, 180);
  if (lat === null || lng === null) {
    return res.status(400).json({ error: 'lat and lng must be coordinates' });
  }

  const user = await requireUser(req, res);
  if (!user) return;
  if (!rateLimit(res, `geocode:${user.id}`, 60, 60_000)) return;

  const apiKey = googleMapsServerKey();
  if (!apiKey) {
    console.error('Google Maps API key is missing');
    return res.status(500).json({ error: 'Google Maps API key not configured' });
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('key', apiKey);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Google Maps API HTTP error: ${response.status}`);
      return res.status(502).json({ error: 'Address lookup failed' });
    }

    const data = await response.json();

    // Google's error_message can describe the key's own restrictions; it
    // stays in the server log.
    if (data.status && data.status !== 'OK') {
      console.error(`Google Maps API status error: ${data.status}`, data.error_message);
      return res.status(502).json({ error: `Address lookup failed: ${data.status}` });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return res.status(502).json({ error: 'Failed to fetch address from Google Maps' });
  }
}
