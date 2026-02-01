import { useState } from 'react';
import type { Prediction } from '../../types';

/**
 * Hook for managing search/autocomplete state
 * Handles input value, predictions, and dropdown visibility
 */
export function useSearchState() {
  const [inputValue, setInputValue] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  return {
    inputValue,
    setInputValue,
    predictions,
    setPredictions,
    showDropdown,
    setShowDropdown
  };
}

