import { useState, useRef, useEffect, useCallback } from 'react';
import type { Prediction } from '../../types';

interface MapSearchProps {
  onPlaceSelect: (prediction: Prediction) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  predictions: Prediction[];
  onPredictionsChange: (predictions: Prediction[]) => void;
  onShowDropdownChange?: (show: boolean) => void;
}

export const MapSearch = ({ 
  onPlaceSelect, 
  inputValue, 
  onInputChange, 
  predictions, 
  onPredictionsChange,
  onShowDropdownChange
}: MapSearchProps) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  // Update showDropdown and notify parent
  const updateShowDropdown = useCallback((show: boolean) => {
    setShowDropdown(show);
    onShowDropdownChange?.(show);
  }, [onShowDropdownChange]);

  // Fetch predictions from the autocomplete API
  const fetchPredictions = async (input: string): Promise<Prediction[]> => {
    if (!input.trim()) return [];
    
    try {
      const response = await fetch(`/api/autocomplete?input=${encodeURIComponent(input)}`);
      if (!response.ok) throw new Error('Failed to fetch predictions');
      
      const data = await response.json();
      return data.predictions || [];
    } catch (error) {
      console.error('Error fetching predictions:', error);
      return [];
    }
  };

  // Handle input changes and fetch predictions
  const handleInputChange = async (value: string) => {
    onInputChange(value);
    
    if (value.trim()) {
      const newPredictions = await fetchPredictions(value);
      onPredictionsChange(newPredictions);
      updateShowDropdown(newPredictions.length > 0);
    } else {
      onPredictionsChange([]);
      updateShowDropdown(false);
    }
    setSelectedIndex(0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
  };

  // Select a prediction
  const selectPrediction = (index: number) => {
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
  };

  // Handle input focus
  const handleFocus = () => {
    if (inputValue && !justSelectedRef.current) {
      updateShowDropdown(predictions.length > 0);
    }
  };

  // Handle clear button
  const handleClear = () => {
    onInputChange('');
    updateShowDropdown(false);
    onPredictionsChange([]);
    setSelectedIndex(0);
    inputRef.current?.focus();
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        updateShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [updateShowDropdown]);

  return (
    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-30 w-full max-w-xl px-4">
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={handleFocus}
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
        {showDropdown && predictions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-30 w-full bg-white border border-gray-200 rounded-b-lg shadow-lg mt-1 max-h-60 overflow-auto"
          >
            {predictions.map((prediction, i) => (
              <div
                key={prediction.place_id}
                className={`px-4 py-2 cursor-pointer text-gray-800 ${i === selectedIndex ? 'bg-blue-100' : ''}`}
                onMouseDown={() => selectPrediction(i)}
                style={{ fontWeight: i === selectedIndex ? 500 : 400 }}
              >
                {prediction.description}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 