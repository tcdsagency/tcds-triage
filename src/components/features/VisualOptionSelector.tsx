'use client';

import { cn } from '@/lib/utils';

// =============================================================================
// VISUAL OPTION SELECTOR
// Displays options as visual cards with icons for easier identification
// =============================================================================

interface VisualOption {
  value: string;
  label: string;
  icon?: string; // Emoji or icon character
  description?: string;
}

interface VisualOptionSelectorProps {
  options: VisualOption[];
  value: string;
  onChange: (value: string) => void;
  columns?: 2 | 3 | 4;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function VisualOptionSelector({
  options,
  value,
  onChange,
  columns = 3,
  size = 'md',
  className,
}: VisualOptionSelectorProps) {
  // Filter out "Select..." placeholder options
  const displayOptions = options.filter(opt => opt.value !== '');

  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
  };

  const sizes = {
    sm: { padding: 'p-2', icon: 'text-xl', label: 'text-xs' },
    md: { padding: 'p-3', icon: 'text-2xl', label: 'text-sm' },
    lg: { padding: 'p-4', icon: 'text-3xl', label: 'text-sm' },
  };

  return (
    <div className={cn('grid gap-2', gridCols[columns], className)}>
      {displayOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border transition-all text-center',
            sizes[size].padding,
            value === option.value
              ? 'border-amber-500 bg-amber-500/20 ring-2 ring-amber-500/30'
              : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
          )}
        >
          {option.icon && (
            <span className={cn(sizes[size].icon, 'mb-1')}>{option.icon}</span>
          )}
          <span className={cn(
            sizes[size].label,
            'font-medium',
            value === option.value ? 'text-amber-300' : 'text-gray-300'
          )}>
            {option.label}
          </span>
          {option.description && (
            <span className="text-xs text-gray-500 mt-0.5">{option.description}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// PRE-DEFINED VISUAL OPTIONS WITH ICONS
// =============================================================================

export const VISUAL_PROPERTY_TYPES: VisualOption[] = [
  { value: 'single_family', label: 'Single Family', icon: '🏠' },
  { value: 'condo', label: 'Condo/Townhouse', icon: '🏢' },
  { value: 'multi_family', label: 'Multi-Family', icon: '🏘️', description: '2-4 units' },
  { value: 'mobile_home', label: 'Mobile Home', icon: '🏡' },
];

export const VISUAL_OCCUPANCY_TYPES: VisualOption[] = [
  { value: 'owner', label: 'Owner Occupied', icon: '🔑', description: 'Primary residence' },
  { value: 'secondary', label: 'Secondary', icon: '🏖️', description: 'Vacation home' },
  { value: 'rental', label: 'Rental', icon: '📋', description: 'Investment property' },
  { value: 'vacant', label: 'Vacant', icon: '🚫', description: 'Unoccupied' },
];

export const VISUAL_CONSTRUCTION_TYPES: VisualOption[] = [
  { value: 'frame', label: 'Wood Frame', icon: '🪵' },
  { value: 'masonry', label: 'Brick/Stone', icon: '🧱' },
  { value: 'masonry_veneer', label: 'Masonry Veneer', icon: '🏛️' },
  { value: 'steel', label: 'Steel Frame', icon: '🔩' },
  { value: 'log', label: 'Log Home', icon: '🪓' },
];

export const VISUAL_FOUNDATION_TYPES: VisualOption[] = [
  { value: 'slab', label: 'Slab', icon: '⬛', description: 'Concrete slab' },
  { value: 'crawl_space', label: 'Crawl Space', icon: '🕳️', description: 'Elevated' },
  { value: 'basement', label: 'Basement', icon: '🏚️', description: 'Below grade' },
  { value: 'pier_beam', label: 'Pier & Beam', icon: '🏗️', description: 'Posts' },
];

export const VISUAL_ROOF_MATERIALS: VisualOption[] = [
  { value: 'asphalt_shingle', label: 'Asphalt Shingle', icon: '🔲', description: 'Standard' },
  { value: 'architectural_shingle', label: 'Architectural', icon: '🔳', description: 'Dimensional' },
  { value: 'metal', label: 'Metal', icon: '🔧', description: 'Steel/Aluminum' },
  { value: 'tile', label: 'Tile', icon: '🟫', description: 'Clay/Concrete' },
  { value: 'slate', label: 'Slate', icon: '⬜', description: 'Natural stone' },
  { value: 'wood_shake', label: 'Wood Shake', icon: '🪵', description: 'Cedar' },
  { value: 'flat', label: 'Flat/Built-Up', icon: '⬜', description: 'Commercial style' },
];

export const VISUAL_POOL_TYPES: VisualOption[] = [
  { value: 'inground', label: 'In-Ground', icon: '🏊', description: 'Permanent' },
  { value: 'above_ground', label: 'Above Ground', icon: '🛁', description: 'Removable' },
];

export const VISUAL_GARAGE_TYPES: VisualOption[] = [
  { value: 'none', label: 'No Garage', icon: '🚫' },
  { value: 'attached_1', label: 'Attached 1-Car', icon: '🚗' },
  { value: 'attached_2', label: 'Attached 2-Car', icon: '🚙🚗' },
  { value: 'attached_3', label: 'Attached 3-Car', icon: '🚙🚗🚐' },
  { value: 'detached_1', label: 'Detached 1-Car', icon: '🏚️' },
  { value: 'detached_2', label: 'Detached 2-Car', icon: '🏘️' },
  { value: 'carport', label: 'Carport', icon: '⛺' },
];

export const VISUAL_HEATING_TYPES: VisualOption[] = [
  { value: 'central_gas', label: 'Central Gas', icon: '🔥', description: 'Forced air' },
  { value: 'central_electric', label: 'Central Electric', icon: '⚡', description: 'Heat pump' },
  { value: 'electric_baseboard', label: 'Baseboard', icon: '📏', description: 'Electric' },
  { value: 'oil', label: 'Oil Furnace', icon: '🛢️' },
  { value: 'propane', label: 'Propane', icon: '🔵' },
  { value: 'wood_stove', label: 'Wood Stove', icon: '🪵' },
  { value: 'geothermal', label: 'Geothermal', icon: '🌍' },
];

export const VISUAL_WATER_HEATER_TYPES: VisualOption[] = [
  { value: 'gas', label: 'Gas', icon: '🔥' },
  { value: 'electric', label: 'Electric', icon: '⚡' },
  { value: 'tankless_gas', label: 'Tankless Gas', icon: '♨️', description: 'On-demand' },
  { value: 'tankless_electric', label: 'Tankless Electric', icon: '⚡', description: 'On-demand' },
  { value: 'solar', label: 'Solar', icon: '☀️' },
];

export const VISUAL_BOAT_TYPES: VisualOption[] = [
  { value: 'bowrider', label: 'Bowrider', icon: '🚤', description: 'Open bow' },
  { value: 'pontoon', label: 'Pontoon', icon: '🛥️', description: 'Flat deck' },
  { value: 'fishing', label: 'Fishing Boat', icon: '🎣' },
  { value: 'ski_wake', label: 'Ski/Wakeboard', icon: '🏄', description: 'Tow sports' },
  { value: 'cabin_cruiser', label: 'Cabin Cruiser', icon: '⛵', description: 'Overnight' },
  { value: 'sailboat', label: 'Sailboat', icon: '⛵' },
  { value: 'center_console', label: 'Center Console', icon: '🚢' },
  { value: 'bass_boat', label: 'Bass Boat', icon: '🐟' },
];

export const VISUAL_RV_CLASSES: VisualOption[] = [
  { value: 'class_a', label: 'Class A', icon: '🚌', description: 'Bus-style' },
  { value: 'class_b', label: 'Class B', icon: '🚐', description: 'Camper van' },
  { value: 'class_c', label: 'Class C', icon: '🚛', description: 'Cab-over' },
  { value: 'travel_trailer', label: 'Travel Trailer', icon: '🏕️', description: 'Towable' },
  { value: 'fifth_wheel', label: 'Fifth Wheel', icon: '🚚', description: 'Truck bed hitch' },
  { value: 'popup', label: 'Pop-Up', icon: '⛺', description: 'Collapsible' },
];

export const VISUAL_VEHICLE_USAGE: VisualOption[] = [
  { value: 'commute', label: 'Commute', icon: '🏢', description: 'Work/school' },
  { value: 'pleasure', label: 'Pleasure', icon: '🎉', description: 'Recreation only' },
  { value: 'business', label: 'Business', icon: '💼', description: 'Work use' },
  { value: 'rideshare', label: 'Rideshare', icon: '🚕', description: 'Uber/Lyft' },
];

export const VISUAL_DOG_BREEDS: VisualOption[] = [
  { value: 'mixed', label: 'Mixed Breed', icon: '🐕' },
  { value: 'small', label: 'Small Breed', icon: '🐩', description: 'Under 25 lbs' },
  { value: 'medium', label: 'Medium Breed', icon: '🦮', description: '25-50 lbs' },
  { value: 'large', label: 'Large Breed', icon: '🐕‍🦺', description: 'Over 50 lbs' },
  { value: 'pit_bull', label: 'Pit Bull', icon: '🐶', description: 'Restricted breed' },
  { value: 'rottweiler', label: 'Rottweiler', icon: '🐶', description: 'Restricted breed' },
  { value: 'german_shepherd', label: 'German Shepherd', icon: '🐺' },
  { value: 'doberman', label: 'Doberman', icon: '🐶', description: 'Restricted breed' },
];

export default VisualOptionSelector;
