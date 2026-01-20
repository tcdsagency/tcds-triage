'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface AddressSuggestion {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

interface AddressComponents {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (components: AddressComponents) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  error?: string;
}

// =============================================================================
// COMPONENT - Simple address autocomplete without property lookup
// =============================================================================

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder = 'Start typing address...',
  className,
  inputClassName,
  disabled,
  error,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch autocomplete suggestions
  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}`);
      const data = await response.json();
      setSuggestions(data.predictions || []);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Autocomplete error:', err);
      setSuggestions([]);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  // Handle address selection
  const handleSelectAddress = async (suggestion: AddressSuggestion) => {
    onChange(suggestion.description);
    setShowSuggestions(false);

    if (onAddressSelect) {
      try {
        // Get place details for address components
        const detailsResponse = await fetch(`/api/places/details?place_id=${suggestion.place_id}`);
        const details = await detailsResponse.json();

        const street = suggestion.structured_formatting?.main_text || suggestion.description.split(',')[0];
        let city = '';
        let state = '';
        let zip = '';

        if (details.result?.address_components) {
          for (const component of details.result.address_components) {
            const types = component.types || [];
            if (types.includes('locality')) {
              city = component.long_name;
            } else if (types.includes('administrative_area_level_1')) {
              state = component.short_name;
            } else if (types.includes('postal_code')) {
              zip = component.long_name;
            }
          }
        }

        onAddressSelect({ street, city, state, zip });
      } catch (err) {
        console.error('Address details error:', err);
      }
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => value.length >= 3 && suggestions.length > 0 && setShowSuggestions(true)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 bg-gray-900 border rounded-lg text-white placeholder-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-amber-500/50',
          error ? 'border-red-500' : 'border-gray-700',
          disabled && 'opacity-50 cursor-not-allowed',
          inputClassName
        )}
      />

      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}

      {/* Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.place_id}
              type="button"
              onClick={() => handleSelectAddress(suggestion)}
              className={cn(
                'w-full px-3 py-2 flex items-start gap-2 text-left hover:bg-gray-700 transition-colors',
                index !== suggestions.length - 1 && 'border-b border-gray-700'
              )}
            >
              <MapPin className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-white truncate">
                  {suggestion.structured_formatting?.main_text || suggestion.description.split(',')[0]}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {suggestion.structured_formatting?.secondary_text || suggestion.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AddressAutocomplete;
