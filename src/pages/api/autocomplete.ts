import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

interface GoogleMapsResponse {
  predictions: google.maps.places.AutocompletePrediction[];
  status: string;
  error_message?: string;
}

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

  if (typeof input !== 'string') {
    return res.status(400).json({ error: 'Input parameter must be a string' });
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
    // Fetch user's saved properties if authenticated, with priority ranking
    let userProperties: Array<{ 
      id: string; 
      address: string; 
      label: string | null; 
      updated_at: string;
      created_at: string;
    }> = [];
    if (userId) {
      const { data: properties, error: propertiesError } = await supabaseServer
        .from('properties')
        .select('id, address, label, updated_at, created_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }); // Most recently updated first
      
      if (propertiesError) {
        console.error('Error fetching user properties:', propertiesError);
      } else {
        userProperties = properties || [];
      }
    }

    // Handle empty input - return user's recent properties only
    let mapsData: GoogleMapsResponse = { predictions: [], status: 'OK' };
    
    if (input.trim()) {
      // Prepare Google Maps API request
      const mapsUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&types=address`;
      console.log('🔍 [AUTOCOMPLETE] Fetching from Google Maps API...');
      
      const mapsResponse = await fetch(mapsUrl);

      if (!mapsResponse.ok) {
        console.error(`🔍 [AUTOCOMPLETE] Google Maps API HTTP error: ${mapsResponse.status}`);
        return res.status(500).json({ error: `Google Maps API error: ${mapsResponse.status}` });
      }

      mapsData = await mapsResponse.json();
      console.log('🔍 [AUTOCOMPLETE] Google Maps API response status:', mapsData.status);
      
      if (mapsData.status && mapsData.status !== 'OK' && mapsData.status !== 'ZERO_RESULTS') {
        console.error(`🔍 [AUTOCOMPLETE] Google Maps API status error: ${mapsData.status}`, mapsData.error_message);
        return res.status(500).json({ 
          error: `Google Maps API error: ${mapsData.status}`,
          message: mapsData.error_message 
        });
      }
    } else {
      console.log('🔍 [AUTOCOMPLETE] Empty input - returning user properties only');
    }

    // Create synthetic predictions for matching user properties
    const inputLower = input.toLowerCase();
    const matchingUserProperties = input.trim() 
      ? userProperties.filter(prop => {
          const addressLower = prop.address.toLowerCase();
          const labelLower = prop.label?.toLowerCase() || '';
          
          return addressLower.includes(inputLower) || 
                 labelLower.includes(inputLower) ||
                 inputLower.length > 2 && (addressLower.includes(inputLower) || labelLower.includes(inputLower));
        })
      : userProperties.slice(0, 8); // For empty input, return top 8 recent properties

    // Create synthetic predictions for user properties that match but aren't in Google results
    const userPropertyPredictions = matchingUserProperties.map((prop, index) => {
      const addressParts = prop.address.split(',');
      const mainText = prop.label ? `${prop.label}` : addressParts[0];
      const secondaryText = prop.label ? prop.address : addressParts.slice(1).join(',').trim();
      
      return {
        description: prop.address,
        place_id: `user_property_${prop.id}`, // Special place_id for user properties
        structured_formatting: {
          main_text: mainText,
          secondary_text: secondaryText,
          main_text_matched_substrings: [],
          secondary_text_matched_substrings: []
        },
        types: ['user_property'],
        user_property: true,
        property_id: prop.id,
        terms: [],
        matched_substrings: [],
        reference: `user_${prop.id}`,
        ranking: index // Use index as ranking (earlier = more recent)
      } as google.maps.places.AutocompletePrediction & { 
        user_property: boolean; 
        property_id: string; 
        ranking: number 
      };
    });

    // Process Google predictions and mark any that match user properties
    const processedGooglePredictions = (mapsData.predictions || []).map((prediction: google.maps.places.AutocompletePrediction) => {
      const matchingUserProp = userProperties.find(prop => 
        prop.address.toLowerCase().includes(prediction.description.toLowerCase()) ||
        prediction.description.toLowerCase().includes(prop.address.toLowerCase())
      );

      if (matchingUserProp) {
        return {
          ...prediction,
          structured_formatting: {
            ...prediction.structured_formatting,
            main_text: matchingUserProp.label 
              ? `${matchingUserProp.label}` 
              : prediction.structured_formatting.main_text,
            secondary_text: matchingUserProp.label 
              ? matchingUserProp.address 
              : prediction.structured_formatting.secondary_text
          },
          types: [...(prediction.types || []), 'user_property'],
          user_property: true,
          property_id: matchingUserProp.id
        };
      }

      return prediction;
    });

    // Combine and deduplicate predictions
    const allPredictions = [...userPropertyPredictions, ...processedGooglePredictions];
    
    // Remove duplicates (prefer user property versions)
    const uniquePredictions = allPredictions.filter((prediction, index) => {
      const isUserProperty = prediction.types?.includes('user_property');
      
      // If this is a user property, keep it
      if (isUserProperty && prediction.place_id.startsWith('user_property_')) {
        return true;
      }
      
      // If this is a Google prediction, check if we already have a user property version
      const hasUserPropertyVersion = allPredictions.some((other, otherIndex) => 
        otherIndex < index &&
        other.types?.includes('user_property') &&
        (other.description === prediction.description ||
         other.description.toLowerCase().includes(prediction.description.toLowerCase()) ||
         prediction.description.toLowerCase().includes(other.description.toLowerCase()))
      );
      
      return !hasUserPropertyVersion;
    });

    // Sort predictions: user properties first (by recency), then Google predictions
    const sortedPredictions = uniquePredictions.sort((a, b) => {
      const aIsUser = a.types?.includes('user_property') || false;
      const bIsUser = b.types?.includes('user_property') || false;
      
      // User properties always come first
      if (aIsUser && !bIsUser) return -1;
      if (!aIsUser && bIsUser) return 1;
      
      // Among user properties, sort by ranking (recency)
      if (aIsUser && bIsUser) {
        const aRanking = (a as unknown as { ranking?: number }).ranking || 999;
        const bRanking = (b as unknown as { ranking?: number }).ranking || 999;
        return aRanking - bRanking;
      }
      
      // Google predictions maintain their original order
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