import { logger } from '../utils/logger';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { Prediction } from '../../types';
import { supabase } from '../utils/supabaseClient';
import { AUTOCOMPLETE_DEBOUNCE_MS } from '../../constants';

interface MapSearchProps {
  onPlaceSelect: (prediction: Prediction) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  predictions: Prediction[];
  onPredictionsChange: (predictions: Prediction[]) => void;
  onShowDropdownChange?: (show: boolean) => void;
}

const isUserProperty = (prediction: Prediction): boolean =>
  prediction.isUserProperty || prediction.user_property || false;

const getMainText = (prediction: Prediction): string =>
  prediction.displayText || prediction.structured_formatting?.main_text || prediction.description.split(',')[0];

const getSecondaryText = (prediction: Prediction): string =>
  prediction.secondaryText || prediction.structured_formatting?.secondary_text || prediction.description.split(',').slice(1).join(',');

export const MapSearch = ({
  onPlaceSelect,
  inputValue,
  onInputChange,
  predictions,
  onPredictionsChange,
  onShowDropdownChange,
}: MapSearchProps) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);
  // Cancels the in-flight autocomplete request when a newer one starts, so a
  // slow response for "New York" can't overwrite the result for "New".
  const abortRef = useRef<AbortController | null>(null);
  // Debounce timer for input-driven fetches. Focus / clear bypass this.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateShowDropdown = useCallback((show: boolean) => {
    setShowDropdown(show);
    onShowDropdownChange?.(show);
  }, [onShowDropdownChange]);

  // Performs one autocomplete fetch. The caller owns the AbortController so it
  // can cancel us mid-flight; we treat AbortError as a no-op rather than an
  // error, since cancellation is the expected path during fast typing.
  const fetchPredictions = useCallback(async (input: string, signal: AbortSignal): Promise<Prediction[]> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (signal.aborted) return [];
      const response = await fetch(`/api/autocomplete?input=${encodeURIComponent(input)}`, {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
        signal,
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.predictions.map((p: google.maps.places.AutocompletePrediction & { user_property?: boolean; property_id?: string }) => ({
        description: p.description,
        place_id: p.place_id,
        isUserProperty: p.user_property || false,
        property_id: p.property_id || null,
        structured_formatting: p.structured_formatting,
        displayText: p.structured_formatting?.main_text || p.description,
        secondaryText: p.structured_formatting?.secondary_text || '',
      }));
    } catch (error) {
      if ((error as Error).name === 'AbortError') return [];
      logger.error('Error fetching predictions:', error);
      return [];
    }
  }, []);

  // Wraps fetchPredictions with abort-of-previous semantics. Returns [] if a
  // newer request started while we were waiting, so callers can safely write
  // the result back to state without checking themselves.
  const requestPredictions = useCallback(async (input: string): Promise<Prediction[]> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const result = await fetchPredictions(input, controller.signal);
    return controller.signal.aborted ? [] : result;
  }, [fetchPredictions]);

  // Input-driven fetches debounce. We update the controlled input synchronously
  // so typing stays responsive, then schedule the network call.
  const handleInputChange = useCallback((value: string) => {
    onInputChange(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const newPredictions = await requestPredictions(value.trim() ? value : '');
      // requestPredictions returns [] if a newer request superseded us, so the
      // last-typed query is the only one that ever writes to state.
      onPredictionsChange(newPredictions);
      updateShowDropdown(newPredictions.length > 0);
      setSelectedIndex(0);
    }, AUTOCOMPLETE_DEBOUNCE_MS);
  }, [onInputChange, requestPredictions, onPredictionsChange, updateShowDropdown]);

  // Cancel any pending debounce + in-flight fetch when the component unmounts.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const selectPrediction = useCallback((index: number) => {
    const prediction = predictions[index];
    if (!prediction) return;
    justSelectedRef.current = true;
    onInputChange(prediction.description);
    updateShowDropdown(false);
    onPredictionsChange([]);
    setSelectedIndex(0);
    // Drop the keyboard so the property card has the screen.
    inputRef.current?.blur();
    onPlaceSelect(prediction);
    setTimeout(() => { justSelectedRef.current = false; }, 100);
  }, [predictions, onInputChange, updateShowDropdown, onPredictionsChange, onPlaceSelect]);

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
        if (predictions[selectedIndex]) selectPrediction(selectedIndex);
        break;
      case 'Escape':
        updateShowDropdown(false);
        inputRef.current?.blur();
        break;
    }
  }, [showDropdown, predictions, selectedIndex, updateShowDropdown, selectPrediction]);

  const handleFocus = useCallback(async () => {
    if (inputValue && !justSelectedRef.current) {
      updateShowDropdown(predictions.length > 0);
    } else if (!inputValue) {
      const recentPredictions = await requestPredictions('');
      onPredictionsChange(recentPredictions);
      updateShowDropdown(recentPredictions.length > 0);
    }
  }, [inputValue, predictions, updateShowDropdown, requestPredictions, onPredictionsChange]);

  const handleBlur = useCallback(() => {
    updateShowDropdown(false);
  }, [updateShowDropdown]);

  const handleClear = useCallback(async () => {
    onInputChange('');
    // Cancel any pending debounced fetch from prior keystrokes so it can't
    // arrive after the "recent" results and clobber them.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const recentPredictions = await requestPredictions('');
    onPredictionsChange(recentPredictions);
    updateShowDropdown(recentPredictions.length > 0);
    setSelectedIndex(0);
    inputRef.current?.focus();
  }, [onInputChange, requestPredictions, onPredictionsChange, updateShowDropdown]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        updateShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [updateShowDropdown]);

  const hasUserProperties = predictions.some(isUserProperty);
  const showSectionLabel = !inputValue.trim() && hasUserProperties;

  const dropdownContent = showDropdown && predictions.length > 0 ? (
    <div
      ref={dropdownRef}
      id="map-search-listbox"
      role="listbox"
      aria-label="Search results"
      className="absolute z-30 w-full ios-float rounded-[24px] mt-2 overflow-hidden"
    >
      {showSectionLabel && (
        <div className="px-4 pt-2.5 pb-1 text-footnote text-ink-2">Recent</div>
      )}
      {predictions.map((prediction, i) => {
        const isOwned = isUserProperty(prediction);
        const mainText = getMainText(prediction);
        const secondaryText = getSecondaryText(prediction);
        const isSelected = i === selectedIndex;

        return (
          // Long-term this should be a real <button>, but combobox+listbox
          // pattern (per WAI-ARIA APG) actually expects role="option" divs,
          // so this is technically correct for screen readers as long as
          // the listbox/option/aria-selected wiring is in place. The
          // pointerdown + preventDefault keeps selection working on touch
          // (where synthesized mousedown may not fire on a scrollable
          // parent) and prevents the input from blurring before
          // selectPrediction runs.
          <div
            key={prediction.place_id}
            role="option"
            aria-selected={isSelected}
            id={`map-search-option-${i}`}
            className={`flex items-center gap-3 px-4 min-h-[52px] py-2 ${isSelected ? 'bg-surface-2/70' : ''}`}
            onPointerDown={(e) => {
              e.preventDefault();
              selectPrediction(i);
            }}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            {/* Icon */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              isOwned ? 'bg-accent-soft' : 'bg-surface-2'
            }`}>
              {isOwned ? (
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-ink-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="text-subhead font-medium truncate text-ink">{mainText}</div>
              {secondaryText && (
                <div className="text-footnote text-ink-2 truncate">{secondaryText}</div>
              )}
            </div>

            {/* Badge for saved properties */}
            {isOwned && (
              <span className="text-caption font-medium text-accent bg-accent-soft px-2 py-0.5 rounded-full flex-shrink-0">Saved</span>
            )}
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div className="absolute left-1/2 -translate-x-1/2 z-30 w-full max-w-xl sm:max-w-2xl px-3 sm:px-4" style={{ top: 'calc(var(--safe-top) + 12px)' }}>
      <div className="relative w-full">
        {/* Search bar */}
        <div className="relative flex items-center">
          {/* Search icon */}
          <svg
            className="absolute left-3.5 z-10 w-[18px] h-[18px] text-ink-2 pointer-events-none"
            fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>

          <input
            ref={inputRef}
            type="search"
            role="combobox"
            value={inputValue}
            onChange={e => handleInputChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Search for an address or property"
            // Placeholders disappear once the user types — explicit aria-label
            // gives screen readers a stable name.
            aria-label="Search address or saved property"
            aria-autocomplete="list"
            aria-expanded={showDropdown && predictions.length > 0}
            aria-controls="map-search-listbox"
            className="ios-float w-full h-12 pl-11 pr-11 rounded-full text-body text-ink placeholder:text-ink-2 focus:outline-none"

            autoComplete="off"
          />

          {/* Clear button */}
          {inputValue && (
            <button
              type="button"
              className="absolute right-3 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-ink-3 text-white ios-press hit-44"
              onClick={handleClear}
              aria-label="Clear search"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {dropdownContent}
      </div>
    </div>
  );
};
