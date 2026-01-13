// API Route: /api/policy-change
// Handle policy change requests - saves to DB and creates AgencyZoom ticket via Zapier

import { NextRequest, NextResponse } from "next/server";
import { db } from '@/db';
import { policyChangeRequests, policies, customers } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

// =============================================================================
// ZAPIER INTEGRATION
// =============================================================================

const ZAPIER_WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/5343719/uf796g9/";
const PIPELINE_ID = 30699;      // Service Center pipeline
const STAGE_ID = 111160;        // Initial "New" stage

// Map change types to AgencyZoom category IDs
const CHANGE_TYPE_TO_CATEGORY: Record<string, number> = {
  add_vehicle: 115762,      // Policy Modification
  remove_vehicle: 115762,
  replace_vehicle: 115762,
  add_driver: 115762,
  remove_driver: 115762,
  address_change: 115762,
  add_mortgagee: 115762,
  remove_mortgagee: 115762,
  coverage_change: 115762,
  cancel_policy: 115762,
};

// Priority IDs
const PRIORITY_IDS: Record<string, number> = {
  standard: 27902,
  high: 27903,
  urgent: 27904,
};

// No Customer Match fallback
const NO_MATCH_CUSTOMER = {
  id: "22138921",
  email: "4e80kxy3@robot.zapier.com",
  name: "No Customer Match",
};

// Default assignee (CSR)
const DEFAULT_CSR_ID = 5461;

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
  assigneeId?: number;
  assigneeName?: string;
}

// =============================================================================
// POST - Submit Policy Change Request
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: PolicyChangeRequest = await request.json();
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

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

    // Look up the policy and customer info
    let customerId: string | null = null;
    let customerName: string | null = null;
    let customerEmail: string | null = null;
    let customerPhone: string | null = null;

    if (body.policyId) {
      const policyData = await db
        .select({
          customerId: policies.customerId,
        })
        .from(policies)
        .where(eq(policies.id, body.policyId))
        .limit(1);

      if (policyData.length > 0 && policyData[0].customerId) {
        customerId = policyData[0].customerId;

        // Look up customer details
        const customerData = await db
          .select({
            firstName: customers.firstName,
            lastName: customers.lastName,
            email: customers.email,
            phone: customers.phone,
          })
          .from(customers)
          .where(eq(customers.id, customerId))
          .limit(1);

        if (customerData.length > 0) {
          customerName = `${customerData[0].firstName || ''} ${customerData[0].lastName || ''}`.trim();
          customerEmail = customerData[0].email;
          customerPhone = customerData[0].phone;
        }
      }
    }

    // Save to database
    const [changeRequest] = await db
      .insert(policyChangeRequests)
      .values({
        tenantId,
        policyId: body.policyId || null,
        policyNumber: body.policyNumber,
        customerId,
        changeType: body.changeType,
        effectiveDate: body.effectiveDate,
        formData: body.data,
        notes: body.notes || null,
        status: 'pending',
      })
      .returning({ id: policyChangeRequests.id });

    // Log the change request
    console.log('[PolicyChange] New request saved:', {
      id: changeRequest.id,
      type: body.changeType,
      policy: body.policyNumber,
      effective: body.effectiveDate,
    });

    // Generate summary based on change type
    const summary = generateChangeSummary(body.changeType, body.data);

    // ==========================================================================
    // CREATE AGENCYZOOM SERVICE REQUEST VIA ZAPIER
    // ==========================================================================

    let zapierTicketId: string | null = null;

    try {
      // Determine if we need to use No Match fallback (no email)
      const useNoMatch = !customerEmail;

      const effectiveEmail = useNoMatch ? NO_MATCH_CUSTOMER.email : customerEmail;
      const effectiveName = useNoMatch ? NO_MATCH_CUSTOMER.name : (customerName || 'Unknown Customer');

      // Build description with full details
      let ticketDescription = `📋 Policy Change Request\n\n${summary}\n\nPolicy: ${body.policyNumber}\nEffective Date: ${body.effectiveDate}`;

      if (body.notes) {
        ticketDescription += `\n\nNotes: ${body.notes}`;
      }

      // If using No Match, append original customer info
      if (useNoMatch && customerName) {
        ticketDescription += `\n\n--- Original Customer Info ---\nName: ${customerName}`;
        if (customerPhone) ticketDescription += `\nPhone: ${customerPhone}`;
        if (customerId) ticketDescription += `\nCustomer ID: ${customerId}`;
      }

      // Get category and priority
      const categoryId = CHANGE_TYPE_TO_CATEGORY[body.changeType] || 115762;
      const priorityId = body.changeType === 'cancel_policy' ? PRIORITY_IDS.urgent : PRIORITY_IDS.standard;

      // Build Zapier payload - use provided assignee or default
      const assigneeId = body.assigneeId || DEFAULT_CSR_ID;
      const zapierPayload = {
        Name: effectiveName,
        Email: effectiveEmail,
        Subject: `${getChangeTypeLabel(body.changeType)} - ${body.policyNumber}`,
        "Service Desc": ticketDescription,
        "Pipeline Id": PIPELINE_ID,
        "Stage Id": STAGE_ID,
        "Due After Days": body.changeType === 'cancel_policy' ? 0 : 1,
        "Category Id": categoryId,
        "Priority Id": priorityId,
        "Csr Id": assigneeId,
      };

      console.log('[PolicyChange] Sending to Zapier:', {
        name: effectiveName,
        email: effectiveEmail,
        changeType: body.changeType,
        policyNumber: body.policyNumber,
      });

      // Send to Zapier webhook
      const zapierResponse = await fetch(ZAPIER_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zapierPayload),
      });

      if (zapierResponse.ok) {
        const zapierResult = await zapierResponse.json();
        zapierTicketId = zapierResult.id || `zapier-${Date.now()}`;
        console.log('[PolicyChange] Zapier ticket created:', zapierTicketId);
      } else {
        console.error('[PolicyChange] Zapier error:', zapierResponse.status, await zapierResponse.text());
      }
    } catch (zapierError) {
      console.error('[PolicyChange] Zapier webhook error:', zapierError);
      // Don't fail the request if Zapier fails - the change request is already saved
    }

    return NextResponse.json({
      success: true,
      changeRequestId: changeRequest.id,
      ticketId: zapierTicketId,
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
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }

    const conditions = [eq(policyChangeRequests.tenantId, tenantId)];

    if (changeRequestId) {
      conditions.push(eq(policyChangeRequests.id, changeRequestId));
    }
    if (policyNumber) {
      conditions.push(eq(policyChangeRequests.policyNumber, policyNumber));
    }
    if (customerId) {
      conditions.push(eq(policyChangeRequests.customerId, customerId));
    }
    if (status) {
      conditions.push(eq(policyChangeRequests.status, status as any));
    }

    const results = await db
      .select({
        id: policyChangeRequests.id,
        policyNumber: policyChangeRequests.policyNumber,
        changeType: policyChangeRequests.changeType,
        status: policyChangeRequests.status,
        effectiveDate: policyChangeRequests.effectiveDate,
        formData: policyChangeRequests.formData,
        notes: policyChangeRequests.notes,
        createdAt: policyChangeRequests.createdAt,
        processedAt: policyChangeRequests.processedAt,
      })
      .from(policyChangeRequests)
      .where(and(...conditions))
      .orderBy(desc(policyChangeRequests.createdAt))
      .limit(limit);

    const enrichedResults = results.map(r => ({
      ...r,
      changeTypeLabel: getChangeTypeLabel(r.changeType),
      summary: generateChangeSummary(r.changeType, r.formData || {}),
    }));

    return NextResponse.json({
      success: true,
      count: enrichedResults.length,
      changeRequests: enrichedResults,
    });

  } catch (error) {
    console.error("[PolicyChange] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch policy changes" },
      { status: 500 }
    );
  }
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  add_vehicle: 'Add Vehicle',
  remove_vehicle: 'Remove Vehicle',
  replace_vehicle: 'Replace Vehicle',
  add_driver: 'Add Driver',
  remove_driver: 'Remove Driver',
  address_change: 'Address Change',
  add_mortgagee: 'Add Mortgagee/Lienholder',
  remove_mortgagee: 'Remove Mortgagee',
  coverage_change: 'Coverage Change',
  cancel_policy: 'Cancel Policy',
};

function getChangeTypeLabel(changeType: string): string {
  return CHANGE_TYPE_LABELS[changeType] || changeType;
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
