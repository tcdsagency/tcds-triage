'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Loader2, MapPin, Home, CheckCircle } from 'lucide-react';
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

interface PropertyData {
  // Address
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  // Property Details from RPR
  yearBuilt?: number;
  squareFootage?: number;
  stories?: number;
  beds?: number;
  baths?: number;
  roofType?: string;
  foundation?: string;
  constructionType?: string;
  hvac?: string;
  // Values
  estimatedValue?: number;
  assessedValue?: number;
  lastSalePrice?: number;
  lastSaleDate?: string;
  // Owner
  ownerName?: string;
  ownerOccupied?: boolean;
  // From Nearmap
  hasPool?: boolean;
  hasSolar?: boolean;
  roofCondition?: string;
  roofConditionScore?: number;
  treeOverhang?: boolean;
  // Flood Zone
  floodZone?: string;
  floodRisk?: string;
  // Raw data for reference
  rprData?: Record<string, unknown>;
  nearmapData?: Record<string, unknown>;
}

interface AddressLookupProps {
  value: string;
  onChange: (value: string) => void;
  onPropertyData?: (data: PropertyData) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
}

// =============================================================================
// ROOF TYPE MAPPING - RPR to form values
// =============================================================================

const ROOF_TYPE_MAP: Record<string, string> = {
  'composition shingle': 'asphalt_shingle',
  'asphalt shingle': 'asphalt_shingle',
  'asphalt': 'asphalt_shingle',
  'architectural shingle': 'architectural_shingle',
  'dimensional shingle': 'architectural_shingle',
  'metal': 'metal',
  'steel': 'metal',
  'aluminum': 'metal',
  'tile': 'tile',
  'clay tile': 'tile',
  'concrete tile': 'tile',
  'slate': 'slate',
  'wood shake': 'wood_shake',
  'wood shingle': 'wood_shake',
  'cedar': 'wood_shake',
  'flat': 'flat',
  'built-up': 'flat',
  'tar and gravel': 'flat',
  'membrane': 'flat',
  'rubber': 'flat',
};

const FOUNDATION_MAP: Record<string, string> = {
  'slab': 'slab',
  'concrete slab': 'slab',
  'crawl space': 'crawl_space',
  'crawlspace': 'crawl_space',
  'basement': 'basement',
  'full basement': 'basement',
  'partial basement': 'basement',
  'pier': 'pier_beam',
  'pier and beam': 'pier_beam',
  'piers': 'pier_beam',
  'pilings': 'pier_beam',
};

const CONSTRUCTION_MAP: Record<string, string> = {
  'brick': 'masonry',
  'stone': 'masonry',
  'masonry': 'masonry',
  'block': 'masonry',
  'concrete block': 'masonry',
  'brick veneer': 'masonry_veneer',
  'stone veneer': 'masonry_veneer',
  'wood': 'frame',
  'wood frame': 'frame',
  'frame': 'frame',
  'vinyl': 'frame',
  'vinyl siding': 'frame',
  'stucco': 'masonry_veneer',
  'steel': 'steel',
  'metal': 'steel',
  'log': 'log',
};

function normalizeRoofType(roofType: string): string {
  const lower = roofType.toLowerCase().trim();
  return ROOF_TYPE_MAP[lower] || 'asphalt_shingle';
}

function normalizeFoundation(foundation: string): string {
  const lower = foundation.toLowerCase().trim();
  return FOUNDATION_MAP[lower] || 'slab';
}

function normalizeConstruction(construction: string): string {
  const lower = construction.toLowerCase().trim();
  return CONSTRUCTION_MAP[lower] || 'frame';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AddressLookup({
  value,
  onChange,
  onPropertyData,
  placeholder = 'Enter property address...',
  className,
  disabled,
  error,
}: AddressLookupProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
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
    setLookupStatus('idle');

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
    setLookupStatus('loading');

    try {
      // Step 1: Get place details for lat/lng
      const detailsResponse = await fetch(`/api/places/details?place_id=${suggestion.place_id}`);
      const details = await detailsResponse.json();

      let lat = 32.7767;
      let lng = -96.7970;
      let formattedAddress = suggestion.description;

      if (details.result?.geometry?.location) {
        lat = details.result.geometry.location.lat;
        lng = details.result.geometry.location.lng;
      }
      if (details.result?.formatted_address) {
        formattedAddress = details.result.formatted_address;
      }

      // Parse address components
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

      // Step 2: Fetch property data from RPR/Nearmap
      const lookupResponse = await fetch('/api/property/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: suggestion.description, formattedAddress, lat, lng }),
      });

      const lookupData = await lookupResponse.json();

      if (lookupData.success && lookupData.lookup) {
        const rpr = lookupData.lookup.rprData;
        const nearmap = lookupData.lookup.nearmapData;

        // Build property data
        const propertyData: PropertyData = {
          street,
          city: rpr?.address?.city || city,
          state: rpr?.address?.state || state,
          zip: rpr?.address?.zip || zip,
          lat,
          lng,
          yearBuilt: rpr?.yearBuilt,
          squareFootage: rpr?.sqft,
          stories: rpr?.stories,
          beds: rpr?.beds,
          baths: rpr?.baths,
          roofType: rpr?.roofType ? normalizeRoofType(rpr.roofType) : undefined,
          foundation: rpr?.foundation ? normalizeFoundation(rpr.foundation) : undefined,
          constructionType: rpr?.exteriorWalls ? normalizeConstruction(rpr.exteriorWalls) : undefined,
          hvac: rpr?.hvac,
          estimatedValue: rpr?.estimatedValue,
          assessedValue: rpr?.assessedValue,
          lastSalePrice: rpr?.lastSalePrice,
          lastSaleDate: rpr?.lastSaleDate,
          ownerName: rpr?.ownerName,
          ownerOccupied: rpr?.ownerOccupied,
          // Nearmap data
          hasPool: nearmap?.pool?.present,
          hasSolar: nearmap?.solar?.present,
          roofCondition: nearmap?.roof?.condition,
          roofConditionScore: nearmap?.roof?.conditionScore,
          treeOverhang: nearmap?.vegetation?.proximityToStructure === 'touching',
          // Flood Zone from RPR
          floodZone: rpr?.floodZone,
          floodRisk: rpr?.floodRisk,
          // Raw data
          rprData: rpr,
          nearmapData: nearmap,
        };

        onPropertyData?.(propertyData);
        setLookupStatus('success');
      } else {
        // Still return basic address data even if lookup failed
        onPropertyData?.({
          street,
          city,
          state,
          zip,
          lat,
          lng,
        });
        setLookupStatus('success');
      }
    } catch (err) {
      console.error('Address lookup error:', err);
      setLookupStatus('error');
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => value.length >= 3 && setSuggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'w-full px-4 py-3 pl-10 pr-10 bg-gray-900 border rounded-lg text-white placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-amber-500/50',
            error ? 'border-red-500' : 'border-gray-700',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />

        {/* Status indicator */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {lookupStatus === 'loading' && (
            <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
          )}
          {lookupStatus === 'success' && (
            <CheckCircle className="w-4 h-4 text-green-500" />
          )}
        </div>
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}

      {/* Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.place_id}
              onClick={() => handleSelectAddress(suggestion)}
              className={cn(
                'w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-gray-700 transition-colors',
                index !== suggestions.length - 1 && 'border-b border-gray-700'
              )}
            >
              <MapPin className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm text-white">
                  {suggestion.structured_formatting?.main_text || suggestion.description.split(',')[0]}
                </div>
                <div className="text-xs text-gray-400">
                  {suggestion.structured_formatting?.secondary_text || suggestion.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Property data found indicator */}
      {lookupStatus === 'success' && (
        <p className="mt-1 text-xs text-green-400 flex items-center gap-1">
          <Home className="w-3 h-3" />
          Property data found - form prefilled
        </p>
      )}
    </div>
  );
}

export default AddressLookup;
