'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface FeaturePolygon {
  type: string;
  coordinates: number[][][];
  description?: string;
  areaSqft?: number;
  confidence?: number;
}

interface Overlays {
  roof: FeaturePolygon[];
  treeOverhang: FeaturePolygon[];
  pool: FeaturePolygon[];
  solar: FeaturePolygon[];
  building: FeaturePolygon[];
}

interface NearmapMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  surveyDate?: string;
  overlays?: Overlays;
  onError?: () => void;
}

// Overlay colors
const OVERLAY_COLORS = {
  roof: { color: '#EF4444', fillColor: '#EF4444', name: 'Roof' },
  treeOverhang: { color: '#22C55E', fillColor: '#22C55E', name: 'Tree Overhang' },
  pool: { color: '#3B82F6', fillColor: '#3B82F6', name: 'Pool' },
  solar: { color: '#F59E0B', fillColor: '#F59E0B', name: 'Solar' },
  building: { color: '#8B5CF6', fillColor: '#8B5CF6', name: 'Building' },
};

export function NearmapMap({ lat, lng, zoom = 19, surveyDate, overlays, onError }: NearmapMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayersRef = useRef<Record<string, L.GeoJSON | null>>({});

  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentDate, setCurrentDate] = useState(surveyDate);

  // Overlay visibility state
  const [showOverlays, setShowOverlays] = useState({
    roof: false,
    treeOverhang: false,
    pool: false,
    solar: false,
    building: false,
  });

  // Get Nearmap API key
  const nearmapKey = process.env.NEXT_PUBLIC_NEARMAP_API_KEY || process.env.NEARMAP_API_KEY || '';

  // Build tile URL with optional date parameter
  const getTileUrl = (date?: string) => {
    let url = `https://api.nearmap.com/tiles/v3/Vert/{z}/{x}/{y}.jpg?apikey=${nearmapKey}`;
    if (date) {
      const formattedDate = date.replace(/-/g, '');
      url += `&until=${formattedDate}`;
    }
    return url;
  };

  // Convert GeoJSON coordinates to Leaflet format (swap lat/lng)
  const convertCoords = (coords: number[][][]): L.LatLngExpression[][] => {
    return coords.map(ring =>
      ring.map(point => [point[1], point[0]] as L.LatLngExpression)
    );
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: zoom,
      zoomControl: true,
      attributionControl: true,
    });

    mapInstance.current = map;

    // Add base tile layer
    if (nearmapKey) {
      const nearmapLayer = L.tileLayer(getTileUrl(surveyDate), {
        maxZoom: 21,
        minZoom: 10,
        attribution: '&copy; <a href="https://nearmap.com">Nearmap</a>',
      });

      tileLayerRef.current = nearmapLayer;
      nearmapLayer.addTo(map);
      nearmapLayer.on('tileerror', () => {
        setHasError(true);
        onError?.();
      });
      nearmapLayer.on('load', () => {
        setIsLoaded(true);
      });
    } else if (googleKey) {
      const googleLayer = L.tileLayer(
        `https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}`,
        { maxZoom: 21, minZoom: 10, attribution: '&copy; Google Maps' }
      );
      googleLayer.addTo(map);
      setIsLoaded(true);
    } else {
      const osmLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: '&copy; Esri' }
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

    return () => {
      map.remove();
      mapInstance.current = null;
      tileLayerRef.current = null;
      overlayLayersRef.current = {};
    };
  }, [lat, lng, zoom, onError]);

  // Update tile layer when surveyDate changes
  useEffect(() => {
    if (mapInstance.current && tileLayerRef.current && nearmapKey && surveyDate !== currentDate) {
      setIsLoaded(false);
      setCurrentDate(surveyDate);

      mapInstance.current.removeLayer(tileLayerRef.current);

      const newLayer = L.tileLayer(getTileUrl(surveyDate), {
        maxZoom: 21,
        minZoom: 10,
        attribution: '&copy; <a href="https://nearmap.com">Nearmap</a>',
      });

      tileLayerRef.current = newLayer;
      newLayer.addTo(mapInstance.current);
      newLayer.on('load', () => setIsLoaded(true));
    }
  }, [surveyDate, currentDate, nearmapKey]);

  // Update map center when coordinates change
  useEffect(() => {
    if (mapInstance.current) {
      mapInstance.current.setView([lat, lng], zoom);
    }
  }, [lat, lng, zoom]);

  // Render/update overlay layers
  useEffect(() => {
    if (!mapInstance.current || !overlays) return;

    const map = mapInstance.current;

    // Process each overlay type
    (Object.keys(showOverlays) as Array<keyof typeof showOverlays>).forEach((overlayType) => {
      const polygons = overlays[overlayType] || [];
      const isVisible = showOverlays[overlayType];
      const colors = OVERLAY_COLORS[overlayType];

      // Remove existing layer if present
      if (overlayLayersRef.current[overlayType]) {
        map.removeLayer(overlayLayersRef.current[overlayType]!);
        overlayLayersRef.current[overlayType] = null;
      }

      // Add layer if visible and has polygons
      if (isVisible && polygons.length > 0) {
        const geojsonData: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: polygons
            .filter(p => p.coordinates && p.coordinates.length > 0)
            .map(p => ({
              type: 'Feature' as const,
              properties: {
                description: p.description,
                areaSqft: p.areaSqft,
              },
              geometry: {
                type: 'Polygon' as const,
                coordinates: p.coordinates,
              },
            })),
        };

        if (geojsonData.features.length > 0) {
          const layer = L.geoJSON(geojsonData, {
            style: {
              color: colors.color,
              fillColor: colors.fillColor,
              fillOpacity: 0.3,
              weight: 2,
            },
            onEachFeature: (feature, layer) => {
              if (feature.properties?.description || feature.properties?.areaSqft) {
                const popup = `
                  <strong>${colors.name}</strong><br/>
                  ${feature.properties.description ? `${feature.properties.description}<br/>` : ''}
                  ${feature.properties.areaSqft ? `Area: ${Math.round(feature.properties.areaSqft)} sq ft` : ''}
                `;
                layer.bindPopup(popup);
              }
            },
          });

          layer.addTo(map);
          overlayLayersRef.current[overlayType] = layer;
        }
      }
    });
  }, [overlays, showOverlays]);

  // Check if any overlays have data
  const hasOverlayData = overlays && (
    (overlays.roof?.length || 0) > 0 ||
    (overlays.treeOverhang?.length || 0) > 0 ||
    (overlays.pool?.length || 0) > 0 ||
    (overlays.solar?.length || 0) > 0 ||
    (overlays.building?.length || 0) > 0
  );

  const toggleOverlay = (type: keyof typeof showOverlays) => {
    setShowOverlays(prev => ({ ...prev, [type]: !prev[type] }));
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="absolute inset-0 z-0" />

      {/* Overlay Controls */}
      {hasOverlayData && isLoaded && (
        <div className="absolute top-2 left-2 bg-white/95 rounded-lg shadow-lg p-2 z-20 max-w-[180px]">
          <div className="text-xs font-bold text-gray-700 mb-2 border-b pb-1">AI Overlays</div>
          <div className="space-y-1">
            {overlays?.roof && overlays.roof.length > 0 && (
              <button
                onClick={() => toggleOverlay('roof')}
                className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  showOverlays.roof ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="w-3 h-3 rounded" style={{ backgroundColor: showOverlays.roof ? '#EF4444' : '#D1D5DB' }} />
                Roof
              </button>
            )}
            {overlays?.treeOverhang && overlays.treeOverhang.length > 0 && (
              <button
                onClick={() => toggleOverlay('treeOverhang')}
                className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  showOverlays.treeOverhang ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="w-3 h-3 rounded" style={{ backgroundColor: showOverlays.treeOverhang ? '#22C55E' : '#D1D5DB' }} />
                Tree Overhang
              </button>
            )}
            {overlays?.pool && overlays.pool.length > 0 && (
              <button
                onClick={() => toggleOverlay('pool')}
                className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  showOverlays.pool ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="w-3 h-3 rounded" style={{ backgroundColor: showOverlays.pool ? '#3B82F6' : '#D1D5DB' }} />
                Pool
              </button>
            )}
            {overlays?.solar && overlays.solar.length > 0 && (
              <button
                onClick={() => toggleOverlay('solar')}
                className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  showOverlays.solar ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="w-3 h-3 rounded" style={{ backgroundColor: showOverlays.solar ? '#F59E0B' : '#D1D5DB' }} />
                Solar
              </button>
            )}
            {overlays?.building && overlays.building.length > 0 && (
              <button
                onClick={() => toggleOverlay('building')}
                className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  showOverlays.building ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="w-3 h-3 rounded" style={{ backgroundColor: showOverlays.building ? '#8B5CF6' : '#D1D5DB' }} />
                Building
              </button>
            )}
          </div>
        </div>
      )}

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
