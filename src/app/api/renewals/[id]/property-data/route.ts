// API Route: /api/renewals/[id]/property-data
// On-demand Nearmap property data fetch for a renewal

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalComparisons } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nearmapClient, calculateRiskScore } from '@/lib/nearmap';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Load renewal from DB
    const [renewal] = await db
      .select({
        id: renewalComparisons.id,
        lineOfBusiness: renewalComparisons.lineOfBusiness,
        renewalSnapshot: renewalComparisons.renewalSnapshot,
        baselineSnapshot: renewalComparisons.baselineSnapshot,
      })
      .from(renewalComparisons)
      .where(eq(renewalComparisons.id, id))
      .limit(1);

    if (!renewal) {
      return NextResponse.json({ success: false, error: 'Renewal not found' }, { status: 404 });
    }

    // 2. Extract address from snapshots
    const snapshot = (renewal.renewalSnapshot || renewal.baselineSnapshot) as any;
    if (!snapshot) {
      return NextResponse.json({ success: false, error: 'No snapshot data available' }, { status: 404 });
    }

    const addressParts = [
      snapshot.insuredAddress,
      snapshot.insuredCity,
      snapshot.insuredState,
      snapshot.insuredZip,
    ].filter(Boolean);

    if (addressParts.length === 0) {
      return NextResponse.json({ success: false, error: 'No address in renewal snapshot' }, { status: 404 });
    }

    const fullAddress = addressParts.join(', ');

    // 3. Geocode address → lat/lng
    const coords = await geocodeAddress(fullAddress);
    if (!coords) {
      return NextResponse.json({ success: false, error: 'Could not geocode address' }, { status: 422 });
    }

    const { lat, lng } = coords;

    // 4. Check Nearmap configuration
    if (!nearmapClient.isConfigured()) {
      return NextResponse.json({ success: false, error: 'Nearmap API not configured' }, { status: 503 });
    }

    // 5. Get property data (rollups + tile + metrics)
    const propertyData = await nearmapClient.getPropertyData(lat, lng);

    if (!propertyData) {
      return NextResponse.json({ success: false, error: 'Could not fetch property data from Nearmap' }, { status: 502 });
    }

    // 6. Get AI feature polygons for map overlays
    const features = await nearmapClient.getFeatures(lat, lng);

    // 7. Calculate insurance risk score
    const riskScore = calculateRiskScore(propertyData.metrics, features);

    return NextResponse.json({
      success: true,
      propertyData,
      features,
      riskScore,
    });
  } catch (error) {
    console.error('[Property Data] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

/**
 * Geocode an address to lat/lng using Google Maps Geocoding API
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
  if (!apiKey) {
    console.warn('[Property Data] GOOGLE_MAPS_API_KEY not configured, cannot geocode');
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
      console.warn(`[Property Data] Geocoding failed for "${address}": ${data.status}`);
      return null;
    }

    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  } catch (error) {
    console.error('[Property Data] Geocoding error:', error);
    return null;
  }
}
