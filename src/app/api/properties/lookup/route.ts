import { NextRequest, NextResponse } from 'next/server';
import { rprClient } from '@/lib/rpr';

/**
 * POST /api/properties/lookup
 * Look up property data from RPR by address
 * Returns data in flat format for quote wizard PropertyStep
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
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    // Map RPR data to format expected by PropertyStep
    // PropertyStep expects: yearBuilt, squareFootage, stories, constructionType,
    // foundationType, roofMaterial, heatingType, garageType, hasPool, poolType
    return NextResponse.json({
      success: true,
      // Property details for form fields
      yearBuilt: propertyData.yearBuilt,
      squareFootage: propertyData.sqft,
      stories: propertyData.stories,
      constructionType: propertyData.constructionType || propertyData.exteriorWalls,
      foundationType: propertyData.foundationType || propertyData.foundation,
      roofMaterial: propertyData.roofMaterial || propertyData.roofType,
      heatingType: propertyData.heatingType,
      garageType: propertyData.garageType,
      hasPool: propertyData.hasPool || false,
      poolType: propertyData.poolType,
      // Additional data that might be useful
      beds: propertyData.beds,
      baths: propertyData.baths,
      lotSqft: propertyData.lotSqft,
      lotAcres: propertyData.lotAcres,
      coolingType: propertyData.coolingType,
      hasFireplace: propertyData.hasFireplace,
      fireplaces: propertyData.fireplaces,
      basement: propertyData.basement,
      basementType: propertyData.basementType,
      estimatedValue: propertyData.estimatedValue,
      assessedValue: propertyData.assessedValue,
      // Full property data for reference
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
