import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';
import { GoogleMap, LoadScript } from '@react-google-maps/api';
import { v4 as uuidv4 } from 'uuid';
import { CheckIcon, PlusIcon } from '@heroicons/react/24/solid';
import type { User } from '@supabase/supabase-js';
import Image from 'next/image';

const containerStyle = {
  width: '100vw',
  height: '100vh',
};

const US_CENTER = {
  lat: 39.8283, // Geographic center of continental US
  lng: -98.5795,
};

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
const GOOGLE_MAP_LIBRARIES = ["places"] as const;

const DEFAULT_ZOOM = 12;
const SEARCH_ZOOM = 19;
const MAP_TYPE_KEY = 'drop-point-map-type';
const DEFAULT_MAP_TYPE = 'satellite';

// Prediction type for Google Places API
export type Prediction = { description: string; place_id: string; matched_substrings?: unknown; structured_formatting?: unknown; terms?: unknown; types?: string[] };

// Property type matching the properties table
export type Property = {
  id: string | null;
  user_id?: string;
  address: string;
  lat: number;
  lng: number;
  user_selected_lat?: number;
  user_selected_lng?: number;
  label?: string | null;
  notes?: string | null;
  thumbnail_url?: string | null;
};

// PropertyFile type matching the property_files table
export type PropertyFile = {
  id: string;
  property_id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
  user_id: string;
  file_type: string;
  file_size: number;
};

export default function MapPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [mapCenter, setMapCenter] = useState(US_CENTER);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [mapType, setMapType] = useState<string>(DEFAULT_MAP_TYPE);
  const [address, setAddress] = useState<string>('');
  const [addressLoading, setAddressLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  const lastFetchedCenter = useRef<{ lat: number; lng: number } | null>(null);

  const [saving, setSaving] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [savedProperty, setSavedProperty] = useState<Property | null>(null);

  // Add state for uploaded files
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; status: 'uploading' | 'success' | 'error'; error?: string }[]>([]);
  const [rejectedFiles, setRejectedFiles] = useState<{ name: string; size: number }[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [propertyFiles, setPropertyFiles] = useState<PropertyFile[]>([]);

  // Add state to track if the current property is saved
  const [isPropertySaved, setIsPropertySaved] = useState(false);

  // Add state for snapped address coordinates
  const [snappedLatLng, setSnappedLatLng] = useState<{lat: number, lng: number} | null>(null);

  // Add state for floating message
  const [floatMessage, setFloatMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Custom autocomplete state
  const [inputValue, setInputValue] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Tooltip state
  const [showSaveTooltip, setShowSaveTooltip] = useState(false);

  // Track if a search is active
  const [searchActive, setSearchActive] = useState(false);

  // Add state for selected files before upload
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Add state for folders and folder selection
  const [folders, setFolders] = useState<{ id: string; name: string; parentId: string | null }[]>([
    { id: 'master', name: savedProperty ? `All Files for ${savedProperty.address}` : 'All Files', parentId: null },
    // Example nested: { id: 'docs', name: 'Documents', parentId: 'master' }
  ]);
  const [selectedFolder, setSelectedFolder] = useState('master');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Auth guard
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace('/');
      } else {
        setUser(data.user);
      }
      setLoading(false);
    };
    getUser();
  }, [router]);

  // Try to get user's geolocation on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // If denied or unavailable, do nothing (fallback to US_CENTER)
        }
      );
    }
  }, []);

  // Fetch predictions as user types
  useEffect(() => {
    let active = true;
    if (inputValue && !justSelectedRef.current) {
      fetchPredictions(inputValue).then((results) => {
        if (active) {
          setPredictions(results);
          setShowDropdown(true);
          setSelectedIndex(0);
        }
      });
    } else {
      setPredictions([]);
      setShowDropdown(false);
      setSelectedIndex(0);
    }
    justSelectedRef.current = false;
    return () => {
      active = false;
    };
  }, [inputValue]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
      return;
    }
    if (!showDropdown || predictions.length === 0) return;
    if (e.key === 'ArrowDown') {
      setSelectedIndex((prev) => (prev + 1) % predictions.length);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setSelectedIndex((prev) => (prev - 1 + predictions.length) % predictions.length);
      e.preventDefault();
    }
  };

  // Helper to compare coordinates with a small threshold
  function coordsChanged(a: { lat: number; lng: number } | null, b: { lat: number; lng: number } | null) {
    if (!a || !b) return true;
    return Math.abs(a.lat - b.lat) > 0.00001 || Math.abs(a.lng - b.lng) > 0.00001;
  }

  // On dragend or zoom_changed, set hasInteracted and fetch address if center changed
  const handleUserInteraction = useCallback(() => {
    if (map) {
      const center = map.getCenter();
      if (center) {
        const coords = { lat: center.lat(), lng: center.lng() };
        if (coordsChanged(lastFetchedCenter.current, coords)) {
          lastFetchedCenter.current = coords;
          setHasInteracted(true);
          setSearchActive(false);
          setInputValue('');
          fetchAddress(coords.lat, coords.lng);
        }
      }
    }
  }, [map]);

  // Only listen for dragend and zoom_changed for user interaction
  useEffect(() => {
    if (map) {
      const dragendListener = map.addListener('dragend', handleUserInteraction);
      const zoomListener = map.addListener('zoom_changed', handleUserInteraction);
      return () => {
        if (dragendListener) dragendListener.remove();
        if (zoomListener) zoomListener.remove();
      };
    }
  }, [map, handleUserInteraction]);

  // Select a prediction
  const selectPrediction = async (index: number) => {
    const prediction = predictions[index];
    await selectPredictionByPrediction(prediction);
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // On mount, read map type from localStorage
  useEffect(() => {
    const storedType = typeof window !== 'undefined' ? localStorage.getItem(MAP_TYPE_KEY) : null;
    if (storedType === 'roadmap' || storedType === 'satellite') {
      setMapType(storedType);
    } else {
      setMapType(DEFAULT_MAP_TYPE);
    }
  }, []);

  // When mapType changes, save to localStorage and update map if loaded
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MAP_TYPE_KEY, mapType);
    }
    if (map) {
      map.setMapTypeId(mapType as google.maps.MapTypeId);
    }
  }, [mapType, map]);

  // Fetch address for center point
  const fetchAddress = async (lat: number, lng: number) => {
    setAddressLoading(true);
    setAddress('');
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (data.results && data.results[0]) {
        setAddress(data.results[0].formatted_address);
        // Save snapped address coordinates
        const snapped = data.results[0].geometry.location;
        setSnappedLatLng({ lat: snapped.lat, lng: snapped.lng });
      } else {
        setAddress('No address found');
        setSnappedLatLng(null);
      }
    } catch {
      setAddress('Error fetching address');
      setSnappedLatLng(null);
    }
    setAddressLoading(false);
  };

  async function fetchPredictions(input: string): Promise<Prediction[]> {
    if (!input) return [];
    const url = `/api/autocomplete?query=${encodeURIComponent(input)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.predictions || [];
  }

  async function geocodePlaceId(placeId: string): Promise<{ lat: number; lng: number } | null> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${placeId}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.results && data.results[0]) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  }

  const handleSearch = async () => {
    if (!inputValue.trim()) return;
    // Always trigger a search for the current input value
    setShowDropdown(false);
    setPredictions([]);
    setSelectedIndex(0);
    if (inputRef.current) inputRef.current.blur();
    // Find the first prediction that matches the input, or fetch new predictions if needed
    let prediction = predictions.find(p => p.description === inputValue.trim());
    if (!prediction) {
      // Fetch predictions for the current input
      const newPreds = await fetchPredictions(inputValue.trim());
      prediction = newPreds[0];
    }
    if (prediction) {
      await selectPredictionByPrediction(prediction);
    }
  };

  // Helper to select a prediction object
  const selectPredictionByPrediction = async (prediction: Prediction) => {
    if (!prediction) return;
    justSelectedRef.current = true;
    setInputValue(prediction.description);
    setShowDropdown(false);
    setPredictions([]);
    setSelectedIndex(0);
    const loc = await geocodePlaceId(prediction.place_id);
    if (loc) {
      setMapCenter(loc);
      setZoom(SEARCH_ZOOM);
      setHasInteracted(true);
      lastFetchedCenter.current = loc;
      fetchAddress(loc.lat, loc.lng);
      if (map) {
        map.panTo(loc);
        map.setZoom(SEARCH_ZOOM);
      }
    }
  };

  // Save property to Supabase
  const handleSaveProperty = async () => {
    if (!user || !address || !map || !snappedLatLng) return;
    setSaving(true);
    setFloatMessage(null);
    try {
      const center = map.getCenter();
      if (!center) throw new Error('No map center');
      // Check for duplicate property by address for this user
      const { data: existing, error: selectError } = await supabase
        .from('properties')
        .select('*')
        .eq('user_id', user.id)
        .eq('address', address)
        .maybeSingle();
      if (selectError) throw selectError;
      if (existing) {
        setFloatMessage({ text: 'You have already saved this property!', type: 'error' });
        setSaving(false);
        setSavedProperty(existing);
        setShowDetailsModal(true);
        return;
      }
      // Insert new property with both sets of coordinates
      const { data, error } = await supabase.from('properties').insert([
        {
          user_id: user.id,
          address,
          lat: snappedLatLng.lat,
          lng: snappedLatLng.lng,
          user_selected_lat: center.lat(),
          user_selected_lng: center.lng(),
          label: null,
          notes: null,
          thumbnail_url: null,
        },
      ]).select();
      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }
      setFloatMessage({ text: 'Property saved!', type: 'success' });
      setSavedProperty(data && data[0] ? data[0] : null);
      setShowDetailsModal(true);
    } catch {
      setFloatMessage({ text: 'Error saving property.', type: 'error' });
    }
    setSaving(false);
  };

  // Fetch files for the selected property
  useEffect(() => {
    async function fetchFiles() {
      if (!savedProperty || !savedProperty.id) return;
      const { data } = await supabase
        .from('property_files')
        .select('*')
        .eq('property_id', savedProperty.id)
        .order('uploaded_at', { ascending: false });
      if (data) setPropertyFiles(data);
    }
    if (showDetailsModal && savedProperty) {
      fetchFiles();
    }
  }, [showDetailsModal, savedProperty]);

  // Refactor file input handler to only select files, not upload
  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const valid: File[] = [];
    const rejected: { name: string; size: number }[] = [];
    Array.from(files).forEach(file => {
      if (file.size > 20 * 1024 * 1024) {
        rejected.push({ name: file.name, size: file.size });
      } else {
        valid.push(file);
      }
    });
    setRejectedFiles(rejected);
    setSelectedFiles(prev => [...prev, ...valid]);
    // Clear the input value so the same file can be selected again if needed
    e.target.value = '';
  }

  // New upload function, only called when user clicks Start Upload
  async function handleStartUpload() {
    if (!selectedFiles.length || !savedProperty || !savedProperty.id || !user) return;
    setUploadError(null);
    setUploadingFiles(selectedFiles.map(f => ({ name: f.name, status: 'uploading' })));
    for (const file of selectedFiles) {
      try {
        const ext = file.name.split('.').pop();
        const uniqueName = `${uuidv4()}.${ext}`;
        const filePath = `${savedProperty.id}/${uniqueName}`;
        const { error: storageError } = await supabase.storage
          .from('property-files')
          .upload(filePath, file, { upsert: false });
        if (storageError) throw storageError;
        const { data: urlData } = supabase.storage
          .from('property-files')
          .getPublicUrl(filePath);
        const fileUrl = urlData?.publicUrl;
        const { error: dbError } = await supabase.from('property_files').insert([
          {
            property_id: savedProperty.id,
            user_id: user.id,
            file_name: uniqueName,
            file_url: fileUrl,
            file_type: file.type,
            file_size: file.size,
          },
        ]);
        if (dbError) throw dbError;
        setUploadingFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'success' } : f));
      } catch (err: unknown) {
        setUploadingFiles(prev => prev.map(f => {
          let errorMsg = 'Upload failed.';
          if (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
            errorMsg = (err as { message?: string }).message as string;
          }
          return f.name === file.name ? { ...f, status: 'error', error: errorMsg } : f;
        }));
      }
    }
    // Refresh file list
    const { data } = await supabase
      .from('property_files')
      .select('*')
      .eq('property_id', savedProperty.id)
      .order('uploaded_at', { ascending: false });
    if (data) setPropertyFiles(data);
    setSelectedFiles([]); // Clear selected files after upload
  }

  // Add effect to check if the property is already saved whenever address or user changes
  useEffect(() => {
    async function checkIfSaved() {
      if (!user || !address || addressLoading) {
        setIsPropertySaved(false);
        return;
      }
      const { data } = await supabase
        .from('properties')
        .select('id')
        .eq('user_id', user.id)
        .eq('address', address)
        .maybeSingle();
      setIsPropertySaved(!!data);
    }
    checkIfSaved();
  }, [user, address, addressLoading]);

  // Utility to shorten address for display
  function shortAddress(address: string, maxLen = 32) {
    if (address.length <= maxLen) return address;
    const start = address.slice(0, Math.floor(maxLen / 2) - 2);
    const end = address.slice(-Math.floor(maxLen / 2) + 2);
    return `${start}...${end}`;
  }

  // Helper to render nested folders with indentation
  function renderFolderOptions(parentId: string | null = null, level = 0): React.ReactNode[] {
    return folders
      .filter(f => f.parentId === parentId)
      .flatMap(f => [
        <option key={f.id} value={f.id}>{'— '.repeat(level) + f.name}</option>,
        ...renderFolderOptions(f.id, level + 1)
      ]);
  }

  // Handler for creating a new folder
  function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setFolders(prev => [...prev, { id: newId, name: newFolderName.trim(), parentId: selectedFolder }]);
    setSelectedFolder(newId);
    setCreatingFolder(false);
    setNewFolderName('');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <LoadScript
        googleMapsApiKey={GOOGLE_MAPS_API_KEY}
        libraries={[...GOOGLE_MAP_LIBRARIES]}
      >
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={mapCenter}
          zoom={zoom}
          onLoad={setMap}
          mapTypeId={mapType as google.maps.MapTypeId}
          options={{
            tilt: 0,
            rotateControl: false,
            gestureHandling: 'greedy',
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
          }}
        >
          {/* Central cursor overlay */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-30"
            style={{ transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}
          >
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              {/* White outline for contrast */}
              <line x1="18" y1="6" x2="18" y2="30" stroke="white" strokeWidth="5" strokeLinecap="round" />
              <line x1="6" y1="18" x2="30" y2="18" stroke="white" strokeWidth="5" strokeLinecap="round" />
              {/* Blue crosshair */}
              <line x1="18" y1="6" x2="18" y2="30" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="6" y1="18" x2="30" y2="18" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
              {/* Center dot */}
              <circle cx="18" cy="18" r="3" fill="#2563eb" stroke="white" strokeWidth="2" />
            </svg>
          </div>
        </GoogleMap>
        {/* Floating search bar */}
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-20 w-full max-w-xl px-4">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onFocus={() => inputValue && !justSelectedRef.current && setShowDropdown(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search for a place or address..."
              className="w-full px-4 py-3 rounded-lg border border-gray-300 shadow-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold placeholder:font-semibold placeholder:text-gray-400 text-gray-900 text-base"
              autoComplete="off"
              style={{ boxShadow: '0 4px 24px 0 rgba(0,0,0,0.10)' }}
            />
            {inputValue && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xl font-bold focus:outline-none"
                onClick={() => {
                  setInputValue('');
                  setShowDropdown(false);
                  setPredictions([]);
                  setSelectedIndex(0);
                  if (inputRef.current) inputRef.current.focus();
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
            {showDropdown && predictions.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute z-30 w-full bg-white border border-gray-200 rounded-b-lg shadow-lg mt-1 max-h-60 overflow-auto"
              >
                {predictions.map((p, i) => (
                  <div
                    key={p.place_id}
                    className={`px-4 py-2 cursor-pointer text-gray-800 ${i === selectedIndex ? 'bg-blue-100' : ''}`}
                    onMouseDown={() => selectPrediction(i)}
                    style={{ fontWeight: i === selectedIndex ? 500 : 400 }}
                  >
                    {p.description}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Map type toggle */}
        <div className="absolute top-6 left-6 z-30">
          <div className="flex gap-2 bg-white rounded-lg shadow-lg p-2">
            <button
              className={`px-3 py-1 rounded font-semibold text-sm ${mapType === 'roadmap' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border border-gray-300'} cursor-pointer`}
              onClick={() => setMapType('roadmap')}
            >
              Map
            </button>
            <button
              className={`px-3 py-1 rounded font-semibold text-sm ${mapType === 'satellite' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border border-gray-300'} cursor-pointer`}
              onClick={() => setMapType('satellite')}
            >
              Satellite
            </button>
          </div>
        </div>
        {/* Property info card at bottom */}
        {hasInteracted && address && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30 w-full max-w-md px-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 flex flex-col items-center gap-4 border border-blue-100 animate-fade-in relative">
              {/* Save button in top right, properly aligned */}
              <button
                className={`absolute top-4 right-4 rounded-full w-5 h-5 flex items-center justify-center shadow transition-colors border-2 z-10
                  ${isPropertySaved ? 'bg-green-500 border-green-600' : 'bg-white border-blue-200 hover:bg-blue-100 hover:border-blue-400 cursor-pointer'}
                  ${!isPropertySaved ? 'hover:scale-110 active:scale-95 transition-transform' : ''}
                `}
                style={{ fontSize: '0.7rem' }}
                disabled={isPropertySaved}
                onClick={async () => {
                  if (!isPropertySaved) {
                    // Only save, do not open modal
                    if (!user || !address || !map || !snappedLatLng) return;
                    setSaving(true);
                    setFloatMessage(null);
                    try {
                      const center = map.getCenter();
                      if (!center) throw new Error('No map center');
                      // Check for duplicate property by address for this user
                      const { data: existing, error: selectError } = await supabase
                        .from('properties')
                        .select('*')
                        .eq('user_id', user.id)
                        .eq('address', address)
                        .maybeSingle();
                      if (selectError) throw selectError;
                      if (existing) {
                        setFloatMessage({ text: 'You have already saved this property!', type: 'error' });
                        setSaving(false);
                        setIsPropertySaved(true);
                        return;
                      }
                      // Insert new property with both sets of coordinates
                      const { data, error } = await supabase.from('properties').insert([
                        {
                          user_id: user.id,
                          address,
                          lat: snappedLatLng.lat,
                          lng: snappedLatLng.lng,
                          user_selected_lat: center.lat(),
                          user_selected_lng: center.lng(),
                          label: null,
                          notes: null,
                          thumbnail_url: null,
                        },
                      ]).select();
                      if (error) {
                        console.error('Supabase insert error:', error);
                        throw error;
                      }
                      setFloatMessage({ text: 'Property saved!', type: 'success' });
                      setIsPropertySaved(true);
                    } catch {
                      setFloatMessage({ text: 'Failed to save property. Try again.', type: 'error' });
                    }
                    setTimeout(() => setFloatMessage(null), 2500);
                    setSaving(false);
                  }
                }}
                aria-label={isPropertySaved ? 'Property saved' : 'Add property'}
                onMouseEnter={() => setShowSaveTooltip(true)}
                onMouseLeave={() => setShowSaveTooltip(false)}
              >
                {isPropertySaved ? (
                  <CheckIcon className="w-3 h-3 text-white" />
                ) : (
                  <PlusIcon className="w-3 h-3 text-blue-600" />
                )}
                {/* Tooltip */}
                {showSaveTooltip && (
                  <div className="absolute right-0 top-7 bg-gray-900 text-white text-xs rounded px-2 py-1 shadow z-20 whitespace-nowrap">
                    {isPropertySaved ? 'Saved' : 'Add to list'}
                  </div>
                )}
              </button>
              <div className="text-gray-900 text-lg font-semibold text-center">
                {addressLoading ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading address...
                  </div>
                ) : address}
              </div>
              <button
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg shadow hover:bg-blue-700 transition-all disabled:opacity-60 cursor-pointer"
                disabled={addressLoading || !address || address === 'No address found' || address === 'Error fetching address' || saving}
                onClick={() => {
                  if (map) {
                    const center = map.getCenter();
                    setSavedProperty({
                      address,
                      lat: center?.lat() ?? 0,
                      lng: center?.lng() ?? 0,
                      label: null,
                      notes: null,
                      id: null, // Not saved yet
                    });
                    setShowDetailsModal(true);
                  }
                }}
              >
                Select
              </button>
            </div>
          </div>
        )}
        {/* Property details modal */}
        {showDetailsModal && savedProperty && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all animate-fade-in"
            onClick={e => {
              // Only close if clicking the backdrop, not the modal itself
              if (e.target === e.currentTarget) {
                setShowDetailsModal(false);
                setUploadingFiles([]);
                setRejectedFiles([]);
                setUploadError(null);
              }
            }}
          >
            <div className="bg-white/90 rounded-3xl shadow-2xl p-0 w-full max-w-md relative flex flex-col gap-0 border border-blue-100 overflow-hidden" style={{ borderRadius: '1.5rem' }} onClick={e => e.stopPropagation()}>
              {/* Header with address, dropdown, and close */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-blue-100 bg-white/90">
                <div className="flex-1 flex items-center justify-center gap-2 relative">
                  <span
                    className="text-lg sm:text-xl font-extrabold text-gray-900 truncate max-w-[70vw] cursor-pointer"
                    title={savedProperty.address}
                    style={{ display: 'inline-block', verticalAlign: 'middle', lineHeight: 1, maxWidth: 'calc(100vw - 120px)' }}
                  >
                    {shortAddress(savedProperty.address)}
                  </span>
                  <button className="ml-1 p-1 rounded hover:bg-blue-50 transition-colors" aria-label="More options">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
                <button
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors absolute right-2 top-2"
                  aria-label="Close"
                  onClick={() => {
                    setShowDetailsModal(false);
                    setUploadingFiles([]);
                    setRejectedFiles([]);
                    setUploadError(null);
                  }}
                >
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {/* Property image/preview */}
              <div className="w-full h-40 bg-gray-200 flex items-center justify-center overflow-hidden border-b border-blue-100" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: '1.5rem', borderBottomRightRadius: '1.5rem' }}>
                <div className="rounded-2xl overflow-hidden shadow-md w-full h-full flex items-center justify-center">
                  <StaticMapImage lat={savedProperty.lat} lng={savedProperty.lng} address={savedProperty.address} />
                </div>
              </div>
              {/* Folder selection section */}
              <div className="px-4 pt-4 pb-2 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label htmlFor="folder-select" className="text-gray-700 font-semibold text-base flex items-center gap-1">
                    <svg className="w-5 h-5 text-blue-400 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h2a2 2 0 012 2v2h10a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                    Save to:
                  </label>
                  <select
                    id="folder-select"
                    className="rounded-lg border border-blue-200 px-3 py-1 text-base text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={selectedFolder}
                    onChange={e => {
                      if (e.target.value === 'create-folder') {
                        setCreatingFolder(true);
                      } else {
                        setSelectedFolder(e.target.value);
                        setCreatingFolder(false);
                      }
                    }}
                  >
                    {renderFolderOptions(null)}
                    <option value="create-folder">+ Create New Folder</option>
                  </select>
                </div>
                {creatingFolder && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      className="rounded-lg border border-blue-200 px-3 py-1 text-base text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 flex-1"
                      placeholder="New folder name"
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      autoFocus
                    />
                    <button
                      className="bg-blue-600 text-white rounded-lg px-3 py-1 font-semibold hover:bg-blue-700 transition-all"
                      onClick={e => { e.preventDefault(); handleCreateFolder(); }}
                      type="button"
                    >Create</button>
                    <button
                      className="text-gray-400 hover:text-gray-700 ml-1"
                      onClick={e => { e.preventDefault(); setCreatingFolder(false); setNewFolderName(''); }}
                      type="button"
                    >Cancel</button>
                  </div>
                )}
              </div>
              {/* Divider */}
              <div className="px-4"><div className="border-t border-blue-100 my-2" /></div>
              {/* Uploaded files section - horizontal scroll */}
              <div className="px-4 pt-2 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-blue-700 font-semibold text-base">Uploaded Files</span>
                  <div className="flex-1 border-t border-blue-100" />
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 bg-blue-50/40 rounded-xl px-2 py-2 min-h-[64px]">
                  {propertyFiles.length === 0 && (
                    <span className="text-gray-400 italic self-center">No files uploaded yet.</span>
                  )}
                  {propertyFiles.map((file) => (
                    <div key={file.id} className="flex flex-col items-center gap-1 min-w-[56px]">
                      <FileIcon type={file.file_type?.split('/')[1] || 'file'} label={file.file_type?.split('/')[1]?.toUpperCase() || 'FILE'} />
                      <span className="text-xs text-gray-700 truncate max-w-[48px]">{file.file_name}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Divider */}
              <div className="px-4"><div className="border-t border-blue-100 my-2" /></div>
              {/* Upload File section */}
              <div className="px-4 pt-2 pb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-700 font-semibold text-base">Upload File</span>
                  <div className="flex-1 border-t border-blue-100" />
                </div>
                <button
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white py-3 rounded-2xl font-bold text-lg shadow-lg hover:from-blue-600 hover:to-blue-800 transition-all border-2 border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  type="button"
                  onClick={() => document.getElementById('file-upload-input')?.click()}
                >
                  Upload File
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Floating message in the modal (top center) */}
        {floatMessage && (
          <div className={`fixed top-8 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg font-semibold text-sm animate-fade-in
            ${floatMessage.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
            style={{ pointerEvents: 'none' }}
          >
            {floatMessage.text}
          </div>
        )}
      </LoadScript>
    </div>
  );
}

// --- Helper components ---

function FileIcon({ type, label }: { type: string; label: string }) {
  // Simple icon based on type
  let icon;
  if (type === 'pdf') {
    icon = (
      <svg width="36" height="36" fill="none" viewBox="0 0 36 36"><rect x="4" y="6" width="28" height="24" rx="4" fill="#2563eb" fillOpacity="0.08"/><rect x="8" y="10" width="20" height="16" rx="2" fill="#2563eb" fillOpacity="0.18"/><rect x="14" y="18" width="8" height="4" rx="1" fill="#2563eb" fillOpacity="0.4"/></svg>
    );
  } else if (type === 'doc') {
    icon = (
      <svg width="36" height="36" fill="none" viewBox="0 0 36 36"><rect x="4" y="6" width="28" height="24" rx="4" fill="#2563eb" fillOpacity="0.08"/><rect x="8" y="10" width="20" height="16" rx="2" fill="#2563eb" fillOpacity="0.18"/><rect x="12" y="16" width="12" height="2" rx="1" fill="#2563eb" fillOpacity="0.4"/></svg>
    );
  } else {
    // img or other
    icon = (
      <svg width="36" height="36" fill="none" viewBox="0 0 36 36"><rect x="4" y="6" width="28" height="24" rx="4" fill="#2563eb" fillOpacity="0.08"/><rect x="8" y="10" width="20" height="16" rx="2" fill="#2563eb" fillOpacity="0.18"/><circle cx="18" cy="18" r="4" fill="#2563eb" fillOpacity="0.4"/></svg>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      {icon}
      <div className="text-xs font-semibold text-gray-700">{label}</div>
    </div>
  );
}

function StaticMapImage({ lat, lng, address }: { lat: number; lng: number; address: string }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=17&size=400x200&maptype=satellite&markers=color:blue%7C${lat},${lng}&key=${apiKey}`;
  return (
    <Image
      src={staticMapUrl}
      alt={address}
      width={400}
      height={200}
      className="object-cover w-full h-full"
      style={{ minHeight: 120, minWidth: 200 }}
      priority
    />
  );
}
 