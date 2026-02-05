// API Route: /api/gaya/post-to-az
// Create an AgencyZoom lead from Gaya extracted entities

import { NextRequest, NextResponse } from 'next/server';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';
import type { GayaEntity, GayaField } from '@/types/gaya';

// =============================================================================
// HELPERS
// =============================================================================

/** Get a field value from entity fields array */
function getField(fields: GayaField[], name: string): string | undefined {
  return fields.find((f) => f.name === name)?.value || undefined;
}

/** Find all entities of a given type */
function findEntities(entities: GayaEntity[], entityType: string): GayaEntity[] {
  return entities.filter((e) => e.entity === entityType);
}

// =============================================================================
// HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entities, pipelineId, stageId } = body as {
      entities: GayaEntity[];
      pipelineId: number;
      stageId: number;
    };

    if (!entities?.length) {
      return NextResponse.json(
        { success: false, error: 'Entities are required' },
        { status: 400 }
      );
    }

    if (!pipelineId || !stageId) {
      return NextResponse.json(
        { success: false, error: 'Pipeline and stage are required' },
        { status: 400 }
      );
    }

    // Extract customer info
    const customerEntities = findEntities(entities, 'customer');
    if (!customerEntities.length) {
      return NextResponse.json(
        { success: false, error: 'No customer entity found in extracted data' },
        { status: 400 }
      );
    }

    const customer = customerEntities[0].fields;
    const firstName = getField(customer, 'first_name') || '';
    const lastName = getField(customer, 'last_name') || '';

    if (!firstName && !lastName) {
      return NextResponse.json(
        { success: false, error: 'Customer name is required' },
        { status: 400 }
      );
    }

    // Create lead in AgencyZoom
    const azClient = getAgencyZoomClient();
    const leadResult = await azClient.createLeadFull({
      firstName,
      lastName,
      email: getField(customer, 'email'),
      phone: getField(customer, 'phone') || getField(customer, 'mobile_phone'),
      streetAddress: getField(customer, 'street_address'),
      city: getField(customer, 'city'),
      state: getField(customer, 'state'),
      zip: getField(customer, 'zip'),
      birthday: getField(customer, 'date_of_birth'),
      pipelineId,
      stageId,
      leadType: 'personal',
    });

    if (!leadResult.success) {
      return NextResponse.json(
        { success: false, error: leadResult.error || 'Failed to create lead' },
        { status: 500 }
      );
    }

    console.log(`[Gaya→AZ] Created lead ${leadResult.leadId} for ${firstName} ${lastName}`);

    // Build AgencyZoom URL if we have a lead ID
    const agencyzoomUrl = leadResult.leadId
      ? `https://app.agencyzoom.com/leads/${leadResult.leadId}`
      : undefined;

    return NextResponse.json({
      success: true,
      leadId: leadResult.leadId,
      agencyzoomUrl,
    });
  } catch (error) {
    console.error('[Gaya→AZ] Post error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create AgencyZoom lead',
      },
      { status: 500 }
    );
  }
}
