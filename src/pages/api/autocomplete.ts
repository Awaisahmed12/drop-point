import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseServer = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { input } = req.query;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'Input parameter is required' });
  }

  if (!apiKey) {
    console.error('Google Maps API key is missing for autocomplete');
    return res.status(500).json({ error: 'Google Maps API key not configured' });
  }

  // Get user from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  
  let userId: string | null = null;
  if (token) {
    try {
      const { data: { user }, error } = await supabaseServer.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    } catch (error) {
      console.error('Error verifying token:', error);
    }
  }

  try {
    // Fetch user's saved properties if authenticated
    let userProperties: Array<{ address: string }> = [];
    if (userId) {
      const { data: properties, error: propertiesError } = await supabaseServer
        .from('properties')
        .select('address')
        .eq('user_id', userId);
      
      if (propertiesError) {
        console.error('Error fetching user properties:', propertiesError);
      } else {
        userProperties = properties || [];
      }
    }

    // Prepare Google Maps API request
    const mapsUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&types=address`;
    console.log('🔍 [AUTOCOMPLETE] Fetching from Google Maps API...');
    
    const mapsResponse = await fetch(mapsUrl);

    if (!mapsResponse.ok) {
      console.error(`🔍 [AUTOCOMPLETE] Google Maps API HTTP error: ${mapsResponse.status}`);
      return res.status(500).json({ error: `Google Maps API error: ${mapsResponse.status}` });
    }

    const mapsData = await mapsResponse.json();
    console.log('🔍 [AUTOCOMPLETE] Google Maps API response status:', mapsData.status);
    
    if (mapsData.status && mapsData.status !== 'OK' && mapsData.status !== 'ZERO_RESULTS') {
      console.error(`🔍 [AUTOCOMPLETE] Google Maps API status error: ${mapsData.status}`, mapsData.error_message);
      return res.status(500).json({ 
        error: `Google Maps API error: ${mapsData.status}`,
        message: mapsData.error_message 
      });
    }

    // Process predictions and mark user properties
    const predictions = (mapsData.predictions || []).map((prediction: google.maps.places.AutocompletePrediction) => {
      const isUserProperty = userProperties.some(prop => 
        prop.address.toLowerCase().includes(prediction.description.toLowerCase()) ||
        prediction.description.toLowerCase().includes(prop.address.toLowerCase())
      );

      if (isUserProperty) {
        return {
          ...prediction,
          structured_formatting: {
            ...prediction.structured_formatting,
            main_text: `${prediction.structured_formatting.main_text} [Saved]`
          }
        };
      }

      return prediction;
    });

    // Sort predictions: user properties first
    const sortedPredictions = predictions.sort((a: google.maps.places.AutocompletePrediction, b: google.maps.places.AutocompletePrediction) => {
      const aIsUser = a.structured_formatting?.main_text?.includes('[Saved]') || false;
      const bIsUser = b.structured_formatting?.main_text?.includes('[Saved]') || false;
      
      if (aIsUser && !bIsUser) return -1;
      if (!aIsUser && bIsUser) return 1;
      return 0;
    });

    console.log('🔍 [AUTOCOMPLETE] Returning', sortedPredictions.length, 'predictions');
    res.status(200).json({ 
      predictions: sortedPredictions,
      status: mapsData.status 
    });

  } catch (error) {
    console.error('🔍 [AUTOCOMPLETE] API error:', error);
    res.status(500).json({ error: 'Failed to fetch autocomplete suggestions' });
  }
} 