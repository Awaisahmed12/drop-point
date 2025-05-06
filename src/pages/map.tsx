import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';
import { GoogleMap, LoadScript } from '@react-google-maps/api';
import { v4 as uuidv4 } from 'uuid';

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

export default function MapPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState(US_CENTER);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [mapType, setMapType] = useState<string>(DEFAULT_MAP_TYPE);
  const [address, setAddress] = useState<string>('');
  const [addressLoading, setAddressLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Custom autocomplete state
  const [inputValue, setInputValue] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  const lastFetchedCenter = useRef<{ lat: number; lng: number } | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [savedProperty, setSavedProperty] = useState<any>(null);

  // Add state for selected files at the top of MapPage
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; status: 'uploading' | 'success' | 'error'; error?: string }[]>([]);
  const [rejectedFiles, setRejectedFiles] = useState<{ name: string; size: number }[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [propertyFiles, setPropertyFiles] = useState<any[]>([]);

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
  const handleUserInteraction = () => {
    if (map) {
      const center = map.getCenter();
      if (center) {
        const coords = { lat: center.lat(), lng: center.lng() };
        if (coordsChanged(lastFetchedCenter.current, coords)) {
          lastFetchedCenter.current = coords;
          setHasInteracted(true);
          fetchAddress(coords.lat, coords.lng);
        }
      }
    }
  };

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
  }, [map]);

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
      } else {
        setAddress('No address found');
      }
    } catch {
      setAddress('Error fetching address');
    }
    setAddressLoading(false);
  };

  async function fetchPredictions(input: string): Promise<any[]> {
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
  const selectPredictionByPrediction = async (prediction: any) => {
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
    if (!user || !address || !map) return;
    setSaving(true);
    setSaveMessage(null);
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
        setSaveMessage('You have already saved this property!');
        setSaving(false);
        setSavedProperty(existing);
        setShowDetailsModal(true);
        return;
      }
      // Insert new property
      const { data, error } = await supabase.from('properties').insert([
        {
          user_id: user.id,
          address,
          lat: center.lat(),
          lng: center.lng(),
          label: null,
          notes: null,
          thumbnail_url: null,
        },
      ]).select();
      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }
      setSaveMessage('Property saved!');
      setSavedProperty(data && data[0] ? data[0] : null);
      setShowDetailsModal(true);
    } catch (err: any) {
      setSaveMessage('Error saving property.');
    }
    setSaving(false);
  };

  // Fetch files for the selected property
  useEffect(() => {
    async function fetchFiles() {
      if (!savedProperty) return;
      const { data, error } = await supabase
        .from('property_files')
        .select('*')
        .eq('property_id', savedProperty.id)
        .order('uploaded_at', { ascending: false });
      if (!error) setPropertyFiles(data || []);
    }
    if (showDetailsModal && savedProperty) {
      fetchFiles();
    }
  }, [showDetailsModal, savedProperty]);

  // Multi-file upload handler
  async function handleFilesSelected(files: FileList | null) {
    if (!files || !savedProperty || !user) return;
    setUploadError(null);
    const validFiles: File[] = [];
    const rejected: { name: string; size: number }[] = [];
    Array.from(files).forEach(file => {
      if (file.size > 20 * 1024 * 1024) {
        rejected.push({ name: file.name, size: file.size });
      } else {
        validFiles.push(file);
      }
    });
    setRejectedFiles(rejected);
    if (validFiles.length === 0) return;
    // Start uploading
    setUploadingFiles(validFiles.map(f => ({ name: f.name, status: 'uploading' })));
    for (const file of validFiles) {
      try {
        const ext = file.name.split('.').pop();
        const uniqueName = `${uuidv4()}.${ext}`;
        const filePath = `${savedProperty.id}/${uniqueName}`;
        // Upload to Supabase Storage
        const { error: storageError } = await supabase.storage
          .from('property-files')
          .upload(filePath, file, { upsert: false });
        if (storageError) throw storageError;
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('property-files')
          .getPublicUrl(filePath);
        const fileUrl = urlData?.publicUrl;
        // Insert metadata into property_files
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
      } catch (err: any) {
        setUploadingFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', error: err.message || 'Upload failed.' } : f));
      }
    }
    // Refresh file list
    const { data, error } = await supabase
      .from('property_files')
      .select('*')
      .eq('property_id', savedProperty.id)
      .order('uploaded_at', { ascending: false });
    if (!error) setPropertyFiles(data || []);
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
        libraries={GOOGLE_MAP_LIBRARIES as any}
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
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 flex flex-col items-center gap-4 border border-blue-100 animate-fade-in">
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
                onClick={handleSaveProperty}
              >
                {saving ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </div>
                ) : 'Select Property'}
              </button>
              {saveMessage && (
                <div className={`text-sm font-medium ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'} animate-fade-in`}>
                  {saveMessage}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Property details modal */}
        {showDetailsModal && savedProperty && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all animate-fade-in">
            <div className="bg-white/80 rounded-3xl shadow-2xl p-8 w-full max-w-md relative flex flex-col gap-6 border border-blue-100">
              <button
                className="absolute top-4 right-4 text-gray-400 hover:text-blue-600 text-2xl font-bold focus:outline-none transition-colors cursor-pointer"
                onClick={() => {
                  setShowDetailsModal(false);
                  setUploadingFiles([]);
                  setRejectedFiles([]);
                  setUploadError(null);
                }}
                aria-label="Close"
              >
                ×
              </button>
              {/* Property image area: Static Map only (no Street View) */}
              <div className="w-full h-40 rounded-2xl bg-gray-200 flex items-center justify-center overflow-hidden border border-blue-100 mb-2">
                <StaticMapImage lat={savedProperty.lat} lng={savedProperty.lng} address={savedProperty.address} />
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="text-2xl font-extrabold text-blue-700 mb-1">Property Details</div>
                <div className="text-lg font-semibold text-gray-900 text-center">{savedProperty.label || savedProperty.address}</div>
                {savedProperty.label && (
                  <div className="text-blue-500 text-sm">Label: {savedProperty.label}</div>
                )}
                {savedProperty.notes && (
                  <div className="text-gray-500 text-sm">Notes: {savedProperty.notes}</div>
                )}
              </div>
              {/* Uploaded files section: only show if files exist */}
              {propertyFiles.length > 0 && (
                <div className="mt-2 w-full">
                  <div className="font-semibold mb-2 text-blue-700">Uploaded Files</div>
                  <div className="flex flex-wrap gap-3 mb-4 min-h-[48px] items-center justify-center">
                    {propertyFiles.map((file) => (
                      <FileIcon key={file.id} type={file.file_type?.split('/')[1] || 'file'} label={file.file_name} />
                    ))}
                  </div>
                </div>
              )}
              {/* Upload file section */}
              <div className="border-t border-blue-100 pt-4 mt-2">
                <form className="flex flex-col gap-3" onSubmit={e => e.preventDefault()}>
                  <input
                    id="file-upload-input"
                    type="file"
                    className="sr-only"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.webp,.gif,.bmp,.tiff,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.mp4,.mov,.avi,.mkv,.zip,.rar,.7z,.json,.xml,.rtf,.pages,.numbers,.key,.rcf"
                    onChange={e => handleFilesSelected(e.target.files)}
                  />
                  <button
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg shadow hover:bg-blue-700 transition-all cursor-pointer"
                    type="button"
                    onClick={() => document.getElementById('file-upload-input')?.click()}
                  >
                    Upload File
                  </button>
                  {/* Upload progress and results */}
                  {uploadingFiles.length > 0 && (
                    <div className="flex flex-col gap-1 mt-2">
                      {uploadingFiles.map(f => (
                        <div key={f.name} className="flex items-center gap-2 text-sm">
                          <span className="truncate max-w-[120px]">{f.name}</span>
                          {f.status === 'uploading' && <span className="text-blue-500">Uploading...</span>}
                          {f.status === 'success' && <span className="text-green-600 font-bold">✓ Uploaded</span>}
                          {f.status === 'error' && <span className="text-red-600 font-bold">✗ Failed</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Rejected files */}
                  {rejectedFiles.length > 0 && (
                    <div className="text-xs text-red-600 text-center font-semibold animate-fade-in mt-2">
                      {rejectedFiles.length === 1
                        ? `"${rejectedFiles[0].name}" was too large (max 20MB). Try zipping or splitting large files.`
                        : `${rejectedFiles.length} files were too large (max 20MB). Try zipping or splitting large files.`}
                    </div>
                  )}
                  {uploadError && (
                    <div className="text-xs text-red-600 text-center font-semibold animate-fade-in">{uploadError}</div>
                  )}
                  <div className="text-xs text-gray-500 text-center">Max file size: 20MB. You can select multiple files.</div>
                </form>
              </div>
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

function StaticMapImage({ lat, lng, address }: { lat: number; lng: number; address: string }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=17&size=400x200&maptype=satellite&markers=color:blue%7C${lat},${lng}&key=${apiKey}`;
  return (
    <img
      src={staticMapUrl}
      alt={address}
      className="object-cover w-full h-full"
      style={{ minHeight: 120, minWidth: 200 }}
    />
  );
}
 