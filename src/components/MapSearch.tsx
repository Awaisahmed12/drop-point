import { useState, useRef, useEffect, useCallback } from 'react';
import type { Prediction, PropertyWithFileCount } from '../../types';
import { supabase } from '../utils/supabaseClient';
import { QuickAccessProperties } from './QuickAccessProperties';

interface MapSearchProps {
  onPlaceSelect: (prediction: Prediction) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  predictions: Prediction[];
  onPredictionsChange: (predictions: Prediction[]) => void;
  onShowDropdownChange?: (show: boolean) => void;
  onPropertySelect?: (property: PropertyWithFileCount) => void;
}

// Helper function to check if a prediction is a user property
const isUserProperty = (prediction: Prediction): boolean => {
  return prediction.isUserProperty || prediction.types?.includes('user_property') || false;
};

// Helper function to get main text from prediction
const getMainText = (prediction: Prediction): string => {
  return prediction.structured_formatting?.main_text || prediction.description.split(',')[0];
};

// Helper function to get secondary text from prediction
const getSecondaryText = (prediction: Prediction): string => {
  return prediction.structured_formatting?.secondary_text || prediction.description.split(',').slice(1).join(',');
};

export const MapSearch = ({ 
  onPlaceSelect, 
  inputValue, 
  onInputChange, 
  predictions, 
  onPredictionsChange,
  onShowDropdownChange,
  onPropertySelect
}: MapSearchProps) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showQuickAccess, setShowQuickAccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  // Update showDropdown and notify parent
  const updateShowDropdown = useCallback((show: boolean) => {
    setShowDropdown(show);
    onShowDropdownChange?.(show || showQuickAccess);
  }, [onShowDropdownChange, showQuickAccess]);

  // Update quick access visibility
  const updateShowQuickAccess = useCallback((show: boolean) => {
    setShowQuickAccess(show);
    onShowDropdownChange?.(show || showDropdown);
  }, [onShowDropdownChange, showDropdown]);

  // Fetch predictions from the autocomplete API with auth token
  const fetchPredictions = useCallback(async (input: string): Promise<Prediction[]> => {
    if (!input.trim()) return [];
    
    try {
      // Get the current session to include auth token
      const response = await fetch(`/api/autocomplete?input=${encodeURIComponent(input)}`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const predictions: Prediction[] = data.predictions.map((p: google.maps.places.AutocompletePrediction) => ({
          description: p.description,
          place_id: p.place_id,
          isUserProperty: p.structured_formatting?.main_text?.includes('[Saved]') || false,
        }));
        return predictions;
      }
    } catch (error) {
      console.error('Error fetching predictions:', error);
    }
    return [];
  }, []);

  // Handle input changes and fetch predictions
  const handleInputChange = useCallback(async (value: string) => {
    onInputChange(value);
    
    if (value.trim()) {
      const newPredictions = await fetchPredictions(value);
      onPredictionsChange(newPredictions);
      updateShowDropdown(newPredictions.length > 0);
      updateShowQuickAccess(false);
    } else {
      // When input is empty, fetch user's recent properties as predictions
      const recentPredictions = await fetchPredictions(''); // Empty input will trigger user properties
      onPredictionsChange(recentPredictions);
      updateShowDropdown(recentPredictions.length > 0);
      updateShowQuickAccess(false);
    }
    setSelectedIndex(0);
  }, [onInputChange, fetchPredictions, onPredictionsChange, updateShowDropdown, updateShowQuickAccess]);

  // Select a prediction
  const selectPrediction = useCallback((index: number) => {
    const prediction = predictions[index];
    if (!prediction) return;

    justSelectedRef.current = true;
    onInputChange(prediction.description);
    updateShowDropdown(false);
    onPredictionsChange([]);
    setSelectedIndex(0);
    onPlaceSelect(prediction);

    // Reset the flag after a brief delay
    setTimeout(() => {
      justSelectedRef.current = false;
    }, 100);
  }, [predictions, onInputChange, updateShowDropdown, onPredictionsChange, onPlaceSelect]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || predictions.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, predictions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (predictions[selectedIndex]) {
          selectPrediction(selectedIndex);
        }
        break;
      case 'Escape':
        updateShowDropdown(false);
        inputRef.current?.blur();
        break;
    }
  }, [showDropdown, predictions, selectedIndex, updateShowDropdown, selectPrediction]);

  // Handle input focus
  const handleFocus = useCallback(async () => {
    if (inputValue && !justSelectedRef.current) {
      updateShowDropdown(predictions.length > 0);
    } else if (!inputValue) {
      // Fetch recent properties when focusing on empty input
      const recentPredictions = await fetchPredictions('');
      onPredictionsChange(recentPredictions);
      updateShowDropdown(recentPredictions.length > 0);
      updateShowQuickAccess(false);
    }
  }, [inputValue, predictions, updateShowDropdown, fetchPredictions, onPredictionsChange, updateShowQuickAccess]);

  // Handle input blur
  const handleBlur = useCallback(() => {
    // Immediate update to prevent race conditions
    updateShowDropdown(false);
    updateShowQuickAccess(false);
  }, [updateShowDropdown, updateShowQuickAccess]);

  // Handle clear button
  const handleClear = useCallback(async () => {
    onInputChange('');
    // Fetch recent properties after clearing
    const recentPredictions = await fetchPredictions('');
    onPredictionsChange(recentPredictions);
    updateShowDropdown(recentPredictions.length > 0);
    setSelectedIndex(0);
    updateShowQuickAccess(false);
    inputRef.current?.focus();
  }, [onInputChange, fetchPredictions, onPredictionsChange, updateShowDropdown, updateShowQuickAccess]);

  // Handle property selection from quick access
  const handlePropertySelect = useCallback((property: PropertyWithFileCount) => {
    updateShowQuickAccess(false);
    onPropertySelect?.(property);
  }, [updateShowQuickAccess, onPropertySelect]);

  // Handle click outside to close dropdown and quick access
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        updateShowDropdown(false);
        updateShowQuickAccess(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [updateShowDropdown, updateShowQuickAccess]);

  // Memoize the dropdown content to prevent unnecessary re-renders
  const dropdownContent = showDropdown && predictions.length > 0 ? (
    <div
      ref={dropdownRef}
      className="absolute z-30 w-full bg-white border border-gray-200 rounded-b-lg shadow-lg mt-1 max-h-60 overflow-auto"
    >
      {!inputValue.trim() && (
        <div className="px-4 py-2 border-b border-gray-100 text-sm font-semibold text-gray-600 bg-gray-50">
          Recent Properties
        </div>
      )}
      {predictions.map((prediction, i) => {
        const isUserPropertyFlag = isUserProperty(prediction);
        
        return (
          <div
            key={prediction.place_id}
            className={`px-4 py-2 cursor-pointer text-gray-800 flex items-center gap-2 ${
              i === selectedIndex ? 'bg-blue-100' : ''
            } ${isUserPropertyFlag ? 'border-l-4 border-l-blue-500 bg-blue-50' : ''}`}
            onMouseDown={() => selectPrediction(i)}
            style={{ fontWeight: i === selectedIndex ? 500 : 400 }}
          >
            {isUserPropertyFlag && (
              <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 21v-4a2 2 0 012-2h4a2 2 0 012 2v4" />
              </svg>
            )}
            <div className="flex-1 min-w-0">
              {isUserPropertyFlag ? (
                <div>
                  <div className="font-semibold text-blue-900 truncate">
                    {getMainText(prediction)}
                  </div>
                  <div className="text-sm text-blue-700 truncate">
                    {getSecondaryText(prediction)}
                  </div>
                </div>
              ) : (
                <div className="truncate">{prediction.description}</div>
              )}
            </div>
            {isUserPropertyFlag && (
              <span className="text-xs text-blue-600 font-medium flex-shrink-0">
                My Property
              </span>
            )}
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-30 w-full max-w-xl px-4">
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
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
            onClick={handleClear}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
        {dropdownContent}
      </div>

      {/* Quick Access Properties */}
      <QuickAccessProperties 
        isVisible={showQuickAccess && !showDropdown}
        onPropertySelect={handlePropertySelect}
      />
    </div>
  );
}; 