import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { lat, lng } = req.query;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Missing lat or lng parameter' });
  }

  if (!apiKey) {
    console.error('Google Maps API key is missing');
    return res.status(500).json({ error: 'Google Maps API key not configured' });
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Google Maps API HTTP error: ${response.status}`);
      return res.status(500).json({ error: `Google Maps API error: ${response.status}` });
    }
    
    const data = await response.json();
    
    // Check for Google Maps API specific errors
    if (data.status && data.status !== 'OK') {
      console.error(`Google Maps API status error: ${data.status}`, data.error_message);
      return res.status(500).json({ 
        error: `Google Maps API error: ${data.status}`,
        message: data.error_message 
      });
    }
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return res.status(500).json({ error: 'Failed to fetch address from Google Maps' });
  }
} 