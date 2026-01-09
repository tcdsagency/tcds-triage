'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface NearmapMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  surveyDate?: string;
  onError?: () => void;
}

export function NearmapMap({ lat, lng, zoom = 19, surveyDate, onError }: NearmapMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Get Nearmap API keys
    const nearmapKey = process.env.NEXT_PUBLIC_NEARMAP_API_KEY || process.env.NEARMAP_API_KEY || '';
    const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

    // Initialize map
    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: zoom,
      zoomControl: true,
      attributionControl: true,
    });

    mapInstance.current = map;

    // Add Nearmap WMS layer if API key available
    if (nearmapKey) {
      const nearmapLayer = L.tileLayer(
        `https://api.nearmap.com/tiles/v3/Vert/{z}/{x}/{y}.jpg?apikey=${nearmapKey}`,
        {
          maxZoom: 21,
          minZoom: 10,
          attribution: '&copy; <a href="https://nearmap.com">Nearmap</a>',
        }
      );

      nearmapLayer.addTo(map);
      nearmapLayer.on('tileerror', () => {
        setHasError(true);
        onError?.();
      });
      nearmapLayer.on('load', () => {
        setIsLoaded(true);
      });
    } else if (googleKey) {
      // Fallback to Google Satellite
      const googleLayer = L.tileLayer(
        `https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}`,
        {
          maxZoom: 21,
          minZoom: 10,
          attribution: '&copy; Google Maps',
        }
      );
      googleLayer.addTo(map);
      setIsLoaded(true);
    } else {
      // Fallback to OpenStreetMap satellite
      const osmLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: '&copy; Esri',
        }
      );
      osmLayer.addTo(map);
      setIsLoaded(true);
    }

    // Add property marker
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'property-marker',
        html: '<div style="background: #3B82F6; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    });
    marker.addTo(map);

    // Add approximate property boundary circle (~ 150ft radius)
    const boundaryCircle = L.circle([lat, lng], {
      color: '#3B82F6',
      fillColor: '#3B82F6',
      fillOpacity: 0.1,
      weight: 2,
      radius: 45, // ~150ft in meters
    });
    boundaryCircle.addTo(map);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [lat, lng, zoom, onError]);

  // Update map center when coordinates change
  useEffect(() => {
    if (mapInstance.current) {
      mapInstance.current.setView([lat, lng], zoom);
    }
  }, [lat, lng, zoom]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="absolute inset-0 z-0" />

      {/* Survey date overlay */}
      {surveyDate && isLoaded && (
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-10">
          Survey: {surveyDate}
        </div>
      )}

      {/* Loading overlay */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-center">
            <div className="animate-spin text-3xl mb-2">🛰️</div>
            <p className="text-sm text-gray-600 font-medium">Loading aerial imagery...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-amber-50 z-10">
          <div className="text-center p-4">
            <div className="text-4xl mb-2">⚠️</div>
            <p className="text-amber-800 font-medium">Nearmap imagery unavailable</p>
            <p className="text-xs text-amber-700 mt-1">Using fallback satellite view</p>
          </div>
        </div>
      )}

      {/* Map controls legend */}
      <div className="absolute top-2 right-2 bg-white/90 rounded shadow px-2 py-1 text-xs text-gray-700 z-10">
        Scroll to zoom | Drag to pan
      </div>
    </div>
  );
}
