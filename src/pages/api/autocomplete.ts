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

  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'Input parameter is required' });
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
    const mapsResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&types=address`
    );

    if (!mapsResponse.ok) {
      throw new Error(`Google Maps API error: ${mapsResponse.status}`);
    }

    const mapsData = await mapsResponse.json();
    
    if (mapsData.status !== 'OK' && mapsData.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Maps API error: ${mapsData.status}`);
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

    res.status(200).json({ 
      predictions: sortedPredictions,
      status: mapsData.status 
    });

  } catch (error) {
    console.error('Autocomplete API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 