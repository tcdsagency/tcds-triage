import { NextRequest, NextResponse } from 'next/server';
import { rprClient } from '@/lib/rpr';

/**
 * POST /api/properties/lookup
 * Look up property data from RPR by address
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    console.log('[Property Lookup] Looking up:', address);

    // Look up property from RPR
    const propertyData = await rprClient.lookupProperty(address);

    if (!propertyData) {
      return NextResponse.json(
        { error: 'Property not found', property: null },
        { status: 404 }
      );
    }

    // Return property data
    return NextResponse.json({
      success: true,
      property: propertyData,
    });
  } catch (error) {
    console.error('[Property Lookup] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lookup failed' },
      { status: 500 }
    );
  }
}
