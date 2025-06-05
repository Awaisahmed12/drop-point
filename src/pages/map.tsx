import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';
import { GoogleMap, LoadScript } from '@react-google-maps/api';
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
  folder_id: string | null;
};

// Add a type for folders
export type PropertyFolder = {
  id: string;
  property_id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export default function MapPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
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

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [savedProperty, setSavedProperty] = useState<Property | null>(null);

  // Add state for uploaded files
  const [propertyFiles, setPropertyFiles] = useState<PropertyFile[]>([]);

  // Will be used for property save-on-upload logic
  const [snappedLatLng, setSnappedLatLng] = useState<{lat: number, lng: number} | null>(null);

  // Custom autocomplete state
  const [inputValue, setInputValue] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Replace folders state with backend-driven state
  const [folders, setFolders] = useState<PropertyFolder[]>([]);

  // Add state for error popup
  const [folderErrorPopup, setFolderErrorPopup] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Add state for folders and folder selection (move above all usages)
  const [selectedFolder, setSelectedFolder] = useState('master');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Update folder name validation logic
  const forbiddenFolderChars = /[:;\/\\*?"<>|]/; // Forbid only these special characters
  const maxFolderLength = 50;
  const folderNameError = (name: string) => {
    if (!name) return '';
    if (name[0] === ' ') return "Folder name can't start with a space.";
    if (forbiddenFolderChars.test(name)) return "Folder names can't include : ; / \\ * ? \" < > |";
    if (name.length > maxFolderLength) return `Folder name must be less than ${maxFolderLength} characters.`;
    const trimmed = name.trim();
    if (!trimmed) return '';
    if (folders.some(f => f.parent_id === selectedFolder && f.name.trim().toLowerCase() === trimmed.toLowerCase())) return 'A folder with this name already exists.';
    return '';
  };
  const folderNameValidationMsg = folderNameError(newFolderName);
  const isFolderNameValid = !!newFolderName && !folderNameValidationMsg;

  // Auth guard
  useEffect(() => {
    const getUser = async () => {
      const result = await supabase.auth.getUser();
      if (!result.data.user) {
        router.replace('/');
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

  // Fetch files for the selected property
  useEffect(() => {
    async function fetchFiles() {
      if (!savedProperty || !savedProperty.id) return;
      const result = await supabase
        .from('property_files')
        .select('*')
        .eq('property_id', savedProperty.id)
        .order('uploaded_at', { ascending: false });
      if (result.data) setPropertyFiles(result.data);
    }
    if (showDetailsModal && savedProperty) {
      fetchFiles();
    }
  }, [showDetailsModal, savedProperty]);

  // Load folders from Supabase when opening property details modal
  useEffect(() => {
    async function fetchFolders() {
      if (!showDetailsModal || !savedProperty?.id) return;
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;
      const { data } = await supabase
        .from('property_folders')
        .select('*')
        .eq('property_id', savedProperty.id)
        .eq('user_id', user.data.user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (data) setFolders(data);
    }
    fetchFolders();
  }, [showDetailsModal, savedProperty]);

  // Helper to get folder children
  function getChildFolders(parentId: string | null) {
    return folders.filter(f => f.parent_id === parentId);
  }

  // Utility to shorten address for display
  function shortAddress(address: string, maxLen = 32) {
    if (address.length <= maxLen) return address;
    const start = address.slice(0, Math.floor(maxLen / 2) - 2);
    const end = address.slice(-Math.floor(maxLen / 2) + 2);
    return `${start}...${end}`;
  }

  // Handler for creating a new folder (with auto-rename logic)
  async function handleCreateFolder() {
    if (!newFolderName || folderNameError(newFolderName)) return;
    if (!savedProperty?.id) return;
    const user = await supabase.auth.getUser();
    if (!user.data.user) return;
    const baseName = newFolderName.replace(/\s+$/, '');
    let nameToSave = baseName;
    let suffix = 1;
    // Check for duplicates and auto-rename
    while (folders.some(f => f.parent_id === selectedFolder && f.name.trim().toLowerCase() === nameToSave.trim().toLowerCase())) {
      nameToSave = `${baseName} (${suffix++})`;
    }
    const { data } = await supabase
      .from('property_folders')
      .insert([
        {
          property_id: savedProperty.id,
          user_id: user.data.user.id,
          name: nameToSave,
          parent_id: selectedFolder === 'master' ? null : selectedFolder,
        },
      ])
      .select()
      .single();
    if (!data) {
      setFolderErrorPopup('Error creating folder.');
      return;
    }
    // Refresh folders
    const { data: allFolders } = await supabase
      .from('property_folders')
      .select('*')
      .eq('property_id', savedProperty.id)
      .eq('user_id', user.data.user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (allFolders) setFolders(allFolders);
    setNewFolderName('');
    setCreatingFolder(false);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    console.log('File input changed');
    const filesArray = Array.from(e.target.files || []);
    if (filesArray.length === 0) {
      console.log('No files selected, exiting');
      return;
    }
    if (!savedProperty) {
      console.log('No savedProperty, exiting');
      return;
    }
    console.log('Starting async upload logic');
    (async () => {
      let propertyId = savedProperty.id;
      const user = await supabase.auth.getUser();
      console.log('User:', user.data.user);
      if (!user.data.user) {
        console.log('No user, exiting');
        return;
      }
      // If property not saved, check for existing property by user_id and address
      if (!propertyId) {
        const { data: existing } = await supabase
          .from('properties')
          .select('*')
          .eq('user_id', user.data.user.id)
          .eq('address', savedProperty.address)
          .single();
        propertyId = existing?.id;
        if (!propertyId) {
          const { lat, lng } = snappedLatLng || { lat: savedProperty.lat, lng: savedProperty.lng };
          const { data, error } = await supabase
            .from('properties')
            .insert([
              {
                address: savedProperty.address,
                lat,
                lng,
                user_selected_lat: savedProperty.user_selected_lat ?? lat,
                user_selected_lng: savedProperty.user_selected_lng ?? lng,
                label: savedProperty.label,
                notes: savedProperty.notes,
                user_id: user.data.user.id,
              },
            ])
            .select()
            .single();
          if (error || !data) {
            alert('Error saving property before upload.');
            console.log('Error saving property before upload:', error);
            return;
          }
          setSavedProperty(data);
          propertyId = data.id;
        } else {
          setSavedProperty(existing);
        }
      }
      console.log('propertyId for upload:', propertyId);
      console.log('Files to upload:', filesArray.length);
      for (const file of filesArray) {
        console.log('Preparing to upload file:', file.name);
        const filePath = `${propertyId}/${file.name}`;
        const folderIdForUpload = selectedFolder === 'master' ? null : selectedFolder;
        console.log('Uploading file to folder_id:', folderIdForUpload);
        const { data: uploadData, error: uploadError } = await supabase.storage.from('property-files').upload(filePath, file, { upsert: true });
        if (uploadError) {
          alert(`Error uploading file: ${file.name}`);
          console.error('Upload error:', uploadError);
          continue;
        }
        // Insert file record in DB
        const userId = user.data.user.id;
        console.log('Uploading file to folder_id:', folderIdForUpload);
        const { error: dbError } = await supabase.from('property_files').insert([
          {
            property_id: propertyId,
            file_name: file.name,
            file_url: uploadData?.path || filePath,
            uploaded_at: new Date().toISOString(),
            user_id: userId,
            file_type: file.type,
            file_size: file.size,
            folder_id: folderIdForUpload,
          },
        ]);
        if (dbError) {
          alert(`Error saving file record for: ${file.name}`);
          console.error('DB insert error:', dbError);
        }
      }
      // Refresh file list
      const result = await supabase
        .from('property_files')
        .select('*')
        .eq('property_id', propertyId)
        .order('uploaded_at', { ascending: false });
      if (result.data) setPropertyFiles(result.data);
    })();
    // Reset file input
    e.target.value = '';
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
                disabled={addressLoading || !address || address === 'No address found' || address === 'Error fetching address'}
                onClick={async () => {
                  if (map) {
                    const center = map.getCenter();
                    // Try to fetch property from Supabase by address and user
                    const user = await supabase.auth.getUser();
                    let dbProperty = null;
                    if (user.data.user) {
                      const { data: existing } = await supabase
                        .from('properties')
                        .select('*')
                        .eq('user_id', user.data.user.id)
                        .eq('address', address)
                        .single();
                      dbProperty = existing;
                    }
                    if (dbProperty) {
                      setSavedProperty(dbProperty);
                    } else {
                      setSavedProperty({
                        address,
                        lat: center?.lat() ?? 0,
                        lng: center?.lng() ?? 0,
                        label: null,
                        notes: null,
                        id: null, // Not saved yet
                      });
                    }
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
              if (e.target === e.currentTarget) {
                setShowDetailsModal(false);
                setCreatingFolder(false);
              }
            }}
          >
            <div
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md sm:max-w-lg flex flex-col border border-blue-100 relative"
              style={{ borderRadius: '1.5rem', minHeight: '620px', maxHeight: '96vh', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Address Bar at Top */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2 bg-white border-b border-blue-100">
                <div className="flex items-center gap-2">
                  <span className="text-lg sm:text-xl font-extrabold text-gray-900 truncate max-w-[60vw]" title={savedProperty.address}>
                    {shortAddress(savedProperty.address)}
                  </span>
                </div>
                <button
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                  aria-label="Close"
                  style={{ cursor: 'pointer' }}
                  onClick={() => { setShowDetailsModal(false); setCreatingFolder(false); }}
                >
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {/* Static satellite image with blue pin */}
              <div className="w-full h-40 sm:h-56 relative bg-gray-200 border-b border-blue-100">
                <Image
                  src={`https://maps.googleapis.com/maps/api/staticmap?center=${(snappedLatLng?.lat ?? savedProperty.lat)},${(snappedLatLng?.lng ?? savedProperty.lng)}&zoom=19&size=600x220&maptype=satellite&markers=color:blue%7C${(snappedLatLng?.lat ?? savedProperty.lat)},${(snappedLatLng?.lng ?? savedProperty.lng)}&key=${GOOGLE_MAPS_API_KEY}`}
                  alt="Property satellite view"
                  layout="fill"
                  objectFit="cover"
                  priority
                  unoptimized
                />
                {/* Blue pin overlay for extra clarity (optional) */}
                {/* <img src="/pin.svg" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full w-8 h-8" alt="Pin" /> */}
              </div>
              {/* Search Bar */}
              <div className="px-4 pb-2 pt-2 bg-white">
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-base text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Search files and folders..."
                  // TODO: Implement search/filter logic
                  disabled
                />
              </div>
              {/* File/Folder List */}
              <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-[120px]">
                <div className="flex items-center gap-2 mb-2 text-sm text-blue-700 font-semibold">
                  <span
                    className={`cursor-pointer hover:underline ${selectedFolder === 'master' ? 'font-bold' : ''}`}
                    onClick={() => setSelectedFolder('master')}
                  >Root</span>
                  {selectedFolder !== 'master' && (() => {
                    // Refactor breadcrumb path building to a for loop for type safety
                    let path = [];
                    for (let crumbCurrent = folders.find(f => f.id === selectedFolder); crumbCurrent; crumbCurrent = crumbCurrent.parent_id ? folders.find(f => f.id === crumbCurrent.parent_id) : undefined) {
                      path.unshift(crumbCurrent);
                    }
                    return path.map((folder, idx) => [
                      <span key={`sep-${folder!.id}`}>/</span>,
                      <span
                        key={folder!.id}
                        className={`cursor-pointer hover:underline ${idx === path.length - 1 ? 'font-bold' : ''}`}
                        onClick={() => setSelectedFolder(folder!.id)}
                      >{folder!.name}</span>
                    ]);
                  })()}
                </div>
                <div className="flex flex-col gap-2">
                  {/* Back button if not at root */}
                  {selectedFolder !== 'master' && (
                    <button
                      className="mb-2 text-blue-600 hover:underline text-sm font-semibold flex items-center gap-1 cursor-pointer hover:bg-blue-50 rounded transition-colors"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const currentFolder = folders.find(f => f.id === selectedFolder);
                        const parent = currentFolder?.parent_id || 'master';
                        setSelectedFolder(parent);
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                      Back
                    </button>
                  )}
                  {/* Folders */}
                  {getChildFolders(selectedFolder === 'master' ? null : selectedFolder).map(folder => (
                    <div
                      key={folder.id}
                      className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg shadow-sm cursor-pointer hover:bg-blue-50 transition-all"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedFolder(folder.id)}
                    >
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h2a2 2 0 012 2v2h10a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                      <span className="font-semibold text-gray-900">{folder.name}</span>
                    </div>
                  ))}
                  {/* Files */}
                  {propertyFiles.filter(file => (selectedFolder === 'master' ? !file.folder_id : file.folder_id === selectedFolder)).length === 0 && (
                    <div className="text-gray-400 italic self-center py-6">No files uploaded yet.</div>
                  )}
                  {propertyFiles.filter(file => (selectedFolder === 'master' ? !file.folder_id : file.folder_id === selectedFolder)).map((file) => (
                    <div key={file.id} className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm cursor-pointer hover:bg-blue-50 transition-all border border-gray-100"
                      style={{ cursor: 'pointer' }}
                    >
                      <FileIcon type={file.file_type?.split('/')[1] || 'file'} label={file.file_type?.split('/')[1]?.toUpperCase() || 'FILE'} />
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900 truncate max-w-[120px]">{file.file_name}</span>
                        <span className="text-xs text-gray-500">{file.file_type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Hidden file input for upload */}
              <input id="file-upload-input" type="file" className="hidden" onChange={handleFileInputChange} multiple />
              {/* Bottom Action Bar (inside modal) */}
              <div className="flex w-full bg-white border-t border-blue-100 rounded-b-3xl overflow-hidden" style={{height:'72px'}}>
                <button
                  className="w-1/2 h-full bg-blue-600 text-white text-lg font-bold flex items-center justify-center gap-2 rounded-none rounded-bl-3xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all hover:bg-blue-700"
                  style={{ cursor: 'pointer' }}
                  onClick={() => document.getElementById('file-upload-input')?.click()}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" /></svg>
                  Upload
                </button>
                <button
                  className="w-1/2 h-full bg-gray-100 text-blue-700 text-lg font-bold flex items-center justify-center gap-2 border-l border-blue-100 rounded-none rounded-br-3xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all hover:bg-blue-50"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setCreatingFolder(true)}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Create
                </button>
              </div>
              {/* Folder Creation Popup */}
              {creatingFolder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                  <div className="bg-white rounded-2xl shadow-2xl p-6 w-11/12 max-w-xs flex flex-col gap-4 border border-blue-100 relative">
                    <div className="text-lg font-bold text-gray-900 mb-2">Create New Folder</div>
                    <input
                      ref={folderInputRef}
                      type="text"
                      className="rounded-lg border border-blue-200 px-3 py-2 text-base text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="New folder name"
                      value={newFolderName}
                      onChange={e => {
                        const val = e.target.value;
                        if (val.length === 1 && val[0] === ' ') {
                          setFolderErrorPopup("Folder name can't start with a space.");
                          return;
                        }
                        if (forbiddenFolderChars.test(val)) {
                          setFolderErrorPopup("Folder names can't include : ; / \\ * ? \" < > | ");
                        } else if (val.length > maxFolderLength) {
                          setFolderErrorPopup(`Folder name must be less than ${maxFolderLength} characters.`);
                        } else if (val && folders.some(f => f.parent_id === selectedFolder && f.name.trim().toLowerCase() === val.trim().toLowerCase())) {
                          setFolderErrorPopup("A folder with this name already exists.");
                        } else {
                          setFolderErrorPopup(null);
                        }
                        setNewFolderName(val);
                      }}
                      autoFocus
                    />
                    {folderErrorPopup && (
                      <div className="text-red-500 text-xs mt-1 w-full bg-red-50 border border-red-200 rounded px-2 py-1">
                        {folderErrorPopup}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button
                        className={`flex-1 bg-blue-600 text-white rounded-lg px-3 py-2 font-semibold text-base transition-all ${!isFolderNameValid ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                        onClick={e => { e.preventDefault(); if (isFolderNameValid) { handleCreateFolder(); setCreatingFolder(false); } }}
                        type="button"
                        disabled={!isFolderNameValid}
                      >Create</button>
                      <button
                        className="flex-1 bg-gray-100 text-gray-700 rounded-lg px-3 py-2 font-semibold text-base hover:bg-gray-200"
                        onClick={e => { e.preventDefault(); setCreatingFolder(false); setNewFolderName(''); }}
                        type="button"
                      >Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
 