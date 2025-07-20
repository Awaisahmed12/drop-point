import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../utils/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { input } = req.query;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'Missing input parameter' });
  }

  try {
    // Get user's saved properties first
    const userProperties = await getUserPropertiesMatching(req, input);
    
    // Get Google Places predictions
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&components=country:us`;
    const response = await fetch(url);
    const googleData = await response.json();
    
    // Convert user properties to prediction format
    const userPredictions = userProperties.map((property: any) => ({
      description: property.address,
      place_id: `user_property_${property.id}`, // Special prefix to identify user properties
      types: ['establishment', 'user_property'], // Special type to identify user properties
      matched_substrings: [],
      structured_formatting: {
        main_text: property.address.split(',')[0], // Street address
        secondary_text: property.address.split(',').slice(1).join(','), // City, state, etc.
      },
      user_property: true, // Flag to identify this as a user property
      property_id: property.id // Include property ID for later use
    }));

    // Combine results with user properties first
    const combinedPredictions = [
      ...userPredictions,
      ...(googleData.predictions || [])
    ];

    return res.status(200).json({
      ...googleData,
      predictions: combinedPredictions
    });
  } catch (error) {
    console.error('Error in autocomplete:', error);
    return res.status(500).json({ error: 'Failed to fetch predictions' });
  }
}

async function getUserPropertiesMatching(req: NextApiRequest, input: string) {
  try {
    // Get the user's auth token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return []; // No auth token, return empty array
    }

    const token = authHeader.substring(7);
    
    // Set the auth token for this request
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return []; // Invalid token or no user, return empty array
    }

    // Create a user-authenticated Supabase client to bypass RLS issues
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // Search user's properties that match the input
    const { data: properties, error } = await userSupabase
      .from('properties')
      .select('id, address')
      .eq('user_id', user.id)
      .ilike('address', `%${input}%`) // Case-insensitive search
      .limit(5); // Limit to top 5 matching properties

    if (error) {
      console.error('Error fetching user properties:', error);
      return [];
    }

    return properties || [];
  } catch (error) {
    console.error('Error in getUserPropertiesMatching:', error);
    return [];
  }
} 