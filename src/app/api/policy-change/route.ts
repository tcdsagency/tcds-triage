// API Route: /api/policy-change
// Handle policy change requests

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";

// =============================================================================
// TYPES
// =============================================================================

type ChangeType =
  | 'add_vehicle'
  | 'remove_vehicle'
  | 'replace_vehicle'
  | 'add_driver'
  | 'remove_driver'
  | 'address_change'
  | 'add_mortgagee'
  | 'remove_mortgagee'
  | 'coverage_change'
  | 'cancel_policy';

interface PolicyChangeRequest {
  policyId: string;
  policyNumber: string;
  changeType: ChangeType;
  effectiveDate: string;
  data: Record<string, any>;
  notes?: string;
}

// =============================================================================
// POST - Submit Policy Change Request
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: PolicyChangeRequest = await request.json();

    // Validate required fields
    if (!body.policyNumber || !body.changeType || !body.effectiveDate) {
      return NextResponse.json(
        { error: "Missing required fields: policyNumber, changeType, effectiveDate" },
        { status: 400 }
      );
    }

    // Validate change type
    const validChangeTypes: ChangeType[] = [
      'add_vehicle', 'remove_vehicle', 'replace_vehicle',
      'add_driver', 'remove_driver', 'address_change',
      'add_mortgagee', 'remove_mortgagee', 'coverage_change', 'cancel_policy'
    ];

    if (!validChangeTypes.includes(body.changeType)) {
      return NextResponse.json(
        { error: `Invalid change type. Must be one of: ${validChangeTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate change request ID
    const changeRequestId = nanoid(12);

    // Build the change request record
    const changeRequest = {
      id: changeRequestId,
      policyNumber: body.policyNumber,
      changeType: body.changeType,
      effectiveDate: body.effectiveDate,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      data: body.data,
      notes: body.notes || null,
    };

    // Log the change request (in production, save to database)
    console.log('[PolicyChange] New request:', {
      id: changeRequestId,
      type: body.changeType,
      policy: body.policyNumber,
      effective: body.effectiveDate,
    });

    // TODO: Save to database when policy_change_requests table is created
    // For now, we'll just return success
    // await db.insert(policyChangeRequests).values(changeRequest);

    // Generate summary based on change type
    const summary = generateChangeSummary(body.changeType, body.data);

    return NextResponse.json({
      success: true,
      changeRequestId,
      message: `Policy change request submitted successfully`,
      summary,
      status: 'pending',
      estimatedProcessingTime: getEstimatedProcessingTime(body.changeType),
    });

  } catch (error) {
    console.error("[PolicyChange] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit policy change" },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Get policy change request status
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const changeRequestId = searchParams.get('id');
    const policyNumber = searchParams.get('policyNumber');

    if (!changeRequestId && !policyNumber) {
      return NextResponse.json(
        { error: "Must provide either id or policyNumber parameter" },
        { status: 400 }
      );
    }

    // TODO: Fetch from database
    // For now, return mock data
    return NextResponse.json({
      success: true,
      changeRequests: [],
      message: "No change requests found",
    });

  } catch (error) {
    console.error("[PolicyChange] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch policy changes" },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function generateChangeSummary(changeType: ChangeType, data: Record<string, any>): string {
  switch (changeType) {
    case 'add_vehicle':
      return `Add ${data.year || ''} ${data.make || ''} ${data.model || ''} (VIN: ${data.vin || 'pending'})`;

    case 'remove_vehicle':
      return `Remove vehicle: ${data.vehicleToRemove || 'Unknown'} - Reason: ${data.removalReason || 'Not specified'}`;

    case 'replace_vehicle':
      return `Replace ${data.oldVehicle || 'Unknown'} with ${data.newYear || ''} ${data.newMake || ''} ${data.newModel || ''}`;

    case 'add_driver':
      return `Add driver: ${data.firstName || ''} ${data.lastName || ''} (DOB: ${data.dob || 'Unknown'})`;

    case 'remove_driver':
      return `Remove driver: ${data.driverToRemove || 'Unknown'} - Reason: ${data.removalReason || 'Not specified'}`;

    case 'address_change':
      return `Change address to: ${data.newAddress || ''}, ${data.newCity || ''}, ${data.newState || ''} ${data.newZip || ''}`;

    case 'add_mortgagee':
      return `Add lienholder: ${data.lienholderName || 'Unknown'} for ${data.vehicleOrProperty || 'Unknown'}`;

    case 'remove_mortgagee':
      return `Remove lienholder: ${data.lienholderName || 'Unknown'} from ${data.vehicleOrProperty || 'Unknown'}`;

    case 'coverage_change':
      return `Change ${data.coverageType || 'coverage'} from ${data.currentLimit || 'Unknown'} to ${data.newLimit || 'Unknown'}`;

    case 'cancel_policy':
      return `Cancel policy effective ${data.cancellationDate || 'Unknown'} - Reason: ${data.reason || 'Not specified'}`;

    default:
      return 'Policy change request';
  }
}

function getEstimatedProcessingTime(changeType: ChangeType): string {
  switch (changeType) {
    case 'add_vehicle':
    case 'remove_vehicle':
    case 'replace_vehicle':
      return '1-2 business days';

    case 'add_driver':
    case 'remove_driver':
      return '1-3 business days (pending MVR)';

    case 'address_change':
      return 'Same day';

    case 'add_mortgagee':
    case 'remove_mortgagee':
      return '1-2 business days';

    case 'coverage_change':
      return 'Same day to 1 business day';

    case 'cancel_policy':
      return 'Processed immediately';

    default:
      return '1-3 business days';
  }
}
