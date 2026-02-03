// API Route: /api/policy-change
// Handle policy change requests - saves to DB and creates AgencyZoom ticket via direct API

import { NextRequest, NextResponse } from "next/server";
import { db } from '@/db';
import { policyChangeRequests, policies, customers, serviceTickets } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import {
  SERVICE_PIPELINES,
  PIPELINE_STAGES,
  getDefaultDueDate,
} from "@/lib/api/agencyzoom-service-tickets";
import { outlookClient } from "@/lib/outlook";

// =============================================================================
// AGENCYZOOM INTEGRATION
// =============================================================================

const PIPELINE_ID = SERVICE_PIPELINES.POLICY_SERVICE;    // 30699 - Service Center pipeline
const STAGE_ID = PIPELINE_STAGES.POLICY_SERVICE_NEW;     // 111160 - Initial "New" stage

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

// Default assignee - Lee Tidwell
const DEFAULT_CSR_ID = 94007;

// Fallback email when AZ ticket creation fails
const FALLBACK_EMAIL = "lee.tidwell@tcdsagency.com";

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

    // effectiveDate and notes may be at top level or nested inside data (frontend sends them inside data)
    const effectiveDate = body.effectiveDate || body.data?.effectiveDate;
    const notes = body.notes || body.data?.notes || null;

    // Validate required fields
    if (!body.policyNumber || !body.changeType || !effectiveDate) {
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
        effectiveDate: effectiveDate,
        formData: body.data,
        notes: notes,
        status: 'pending',
      })
      .returning({ id: policyChangeRequests.id });

    // Log the change request
    console.log('[PolicyChange] New request saved:', {
      id: changeRequest.id,
      type: body.changeType,
      policy: body.policyNumber,
      effective: effectiveDate,
    });

    // Generate summary based on change type
    const summary = generateChangeSummary(body.changeType, body.data);

    // ==========================================================================
    // CREATE AGENCYZOOM SERVICE REQUEST VIA DIRECT API
    // ==========================================================================

    let azTicketId: number | string | null = null;

    try {
      // Determine if we need to use No Match fallback (no email/customer)
      const useNoMatch = !customerId;

      // Get the AgencyZoom customer ID - either from matched customer or NCM placeholder
      let azCustomerId: number;
      if (useNoMatch) {
        azCustomerId = parseInt(NO_MATCH_CUSTOMER.id);
      } else {
        // Look up the AgencyZoom ID from our database customer
        // customerId is guaranteed non-null here since useNoMatch = !customerId
        const [dbCustomer] = await db
          .select({ agencyzoomId: customers.agencyzoomId })
          .from(customers)
          .where(eq(customers.id, customerId!))
          .limit(1);

        if (dbCustomer?.agencyzoomId) {
          azCustomerId = parseInt(dbCustomer.agencyzoomId);
        } else {
          // Fall back to NCM if we can't find the AZ ID
          azCustomerId = parseInt(NO_MATCH_CUSTOMER.id);
        }
      }

      // Build description with full form details
      let ticketDescription = `📋 Policy Change Request\n\nType: ${getChangeTypeLabel(body.changeType)}\nPolicy: ${body.policyNumber}\nEffective Date: ${effectiveDate}`;

      if (customerName) {
        ticketDescription += `\nCustomer: ${customerName}`;
        if (customerPhone) ticketDescription += ` | ${customerPhone}`;
      }

      ticketDescription += `\n\n--- Form Details ---\n${formatFormData(body.changeType, body.data)}`;

      if (notes) {
        ticketDescription += `\n\nAdditional Notes: ${notes}`;
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
      // Always assign to Lee Tidwell
      const assigneeId = DEFAULT_CSR_ID;

      // Calculate due date (today for urgent cancellations, tomorrow otherwise)
      const dueDate = body.changeType === 'cancel_policy'
        ? new Date().toISOString().split('T')[0]
        : getDefaultDueDate();

      console.log('[PolicyChange] Creating service ticket via direct API:', {
        customerId: azCustomerId,
        changeType: body.changeType,
        policyNumber: body.policyNumber,
        useNoMatch,
      });

      // Create service ticket via direct AgencyZoom API
      const azClient = getAgencyZoomClient();
      const ticketResult = await azClient.createServiceTicket({
        subject: `${getChangeTypeLabel(body.changeType)} - ${body.policyNumber}`,
        description: ticketDescription,
        customerId: azCustomerId,
        pipelineId: PIPELINE_ID,
        stageId: STAGE_ID,
        priorityId: priorityId,
        categoryId: categoryId,
        csrId: assigneeId,
        dueDate: dueDate,
      });

      if (ticketResult.success || ticketResult.serviceTicketId) {
        azTicketId = ticketResult.serviceTicketId || `az-${Date.now()}`;
        console.log('[PolicyChange] AgencyZoom ticket created:', azTicketId);

        // Store ticket locally
        if (typeof azTicketId === 'number' && azTicketId > 0) {
          try {
            const ticketSubject = `${getChangeTypeLabel(body.changeType)} - ${body.policyNumber}`;
            const priorityName = body.changeType === 'cancel_policy' ? 'Urgent!' : 'Standard';

            await db.insert(serviceTickets).values({
              tenantId,
              azTicketId: azTicketId,
              azHouseholdId: azCustomerId,
              customerId: useNoMatch ? null : customerId,
              subject: ticketSubject,
              description: ticketDescription,
              status: 'active',
              pipelineId: PIPELINE_ID,
              pipelineName: 'Policy Service',
              stageId: STAGE_ID,
              stageName: 'New',
              categoryId: categoryId,
              categoryName: 'Policy Modification',
              priorityId: priorityId,
              priorityName: priorityName,
              csrId: assigneeId,
              dueDate: dueDate,
              azCreatedAt: new Date(),
              source: 'policy_change',
              lastSyncedFromAz: new Date(),
            });
            console.log('[PolicyChange] Ticket stored locally');
          } catch (localDbError) {
            console.error('[PolicyChange] Error storing ticket locally:', localDbError);
            // Don't fail the request if local storage fails
          }
        }
      } else {
        console.error('[PolicyChange] AgencyZoom API error:', ticketResult);
        // AZ returned non-success — send email fallback
        await sendFallbackEmail(body.changeType, body.policyNumber, effectiveDate, customerName, customerPhone, body.data, notes, 'AgencyZoom API returned non-success response');
      }
    } catch (azError) {
      console.error('[PolicyChange] AgencyZoom API error:', azError);
      // AZ failed — send email fallback so nothing is lost
      await sendFallbackEmail(body.changeType, body.policyNumber, effectiveDate, customerName, customerPhone, body.data, notes, azError instanceof Error ? azError.message : 'Unknown AZ error');
    }

    return NextResponse.json({
      success: true,
      changeRequestId: changeRequest.id,
      ticketId: azTicketId,
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

// Format all form data fields into a readable string for the ticket description
function formatFormData(changeType: ChangeType, data: Record<string, any>): string {
  // Skip meta fields that are already shown elsewhere
  const skipKeys = new Set(['effectiveDate', 'notes']);
  const lines: string[] = [];

  const labelMap: Record<string, string> = {
    year: 'Year', make: 'Make', model: 'Model', vin: 'VIN', trim: 'Trim',
    bodyStyle: 'Body Style', usage: 'Usage', annualMileage: 'Annual Mileage',
    garagingAddress: 'Garaging Address', garagingCity: 'City', garagingState: 'State', garagingZip: 'ZIP',
    isFinanced: 'Financed/Leased', lienholderName: 'Lienholder', lienholderAddress: 'Lienholder Address',
    vehicleToRemove: 'Vehicle to Remove', selectedVehicleId: 'Vehicle ID',
    removalReason: 'Reason for Removal', newOwnerInfo: 'New Owner Info',
    isReplacing: 'Replacing Existing Vehicle', replacingVehicleId: 'Vehicle Being Replaced',
    replacingVehicle: 'Vehicle Being Replaced', stillInPossession: 'Still in Possession',
    outOfPossessionDate: 'Out of Possession Date',
    firstName: 'First Name', lastName: 'Last Name', dob: 'Date of Birth',
    licenseNumber: 'License Number', licenseState: 'License State',
    relationship: 'Relationship', maritalStatus: 'Marital Status', gender: 'Gender',
    driverToRemove: 'Driver to Remove', selectedDriverId: 'Driver ID',
    driverRemovalReason: 'Reason for Removal',
    newAddress: 'New Address', newCity: 'City', newState: 'State', newZip: 'ZIP',
    moveDate: 'Move Date', previousAddress: 'Previous Address',
    vehicleOrProperty: 'Vehicle/Property', mortgageeAddress: 'Mortgagee Address',
    loanNumber: 'Loan Number',
    coverageType: 'Coverage Type', currentLimit: 'Current Limit', newLimit: 'New Limit',
    deductible: 'Deductible', reason: 'Reason',
    cancellationDate: 'Cancellation Date', cancellationReason: 'Reason',
    oldVehicle: 'Old Vehicle', newYear: 'New Year', newMake: 'New Make', newModel: 'New Model',
    newVin: 'New VIN',
  };

  for (const [key, value] of Object.entries(data)) {
    if (skipKeys.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    const label = labelMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
    lines.push(`${label}: ${value}`);
  }

  return lines.length > 0 ? lines.join('\n') : 'No additional details provided';
}

// Send fallback email when AgencyZoom ticket creation fails
async function sendFallbackEmail(
  changeType: ChangeType,
  policyNumber: string,
  effectiveDate: string,
  customerName: string | null,
  customerPhone: string | null,
  formData: Record<string, any>,
  notes: string | null,
  errorReason: string,
) {
  try {
    const subject = `[ACTION REQUIRED] Policy Change Request - ${getChangeTypeLabel(changeType)} - ${policyNumber}`;
    const body = [
      `A policy change request was submitted but the AgencyZoom service ticket could NOT be created.`,
      `Error: ${errorReason}`,
      ``,
      `=== Request Details ===`,
      `Type: ${getChangeTypeLabel(changeType)}`,
      `Policy: ${policyNumber}`,
      `Effective Date: ${effectiveDate}`,
      customerName ? `Customer: ${customerName}` : null,
      customerPhone ? `Phone: ${customerPhone}` : null,
      ``,
      `=== Form Data ===`,
      formatFormData(changeType, formData),
      notes ? `\nAdditional Notes: ${notes}` : null,
      ``,
      `Please create the service ticket manually in AgencyZoom.`,
    ].filter(Boolean).join('\n');

    const result = await outlookClient.sendEmail({
      to: FALLBACK_EMAIL,
      subject,
      body,
    });

    if (result.success) {
      console.log(`[PolicyChange] Fallback email sent to ${FALLBACK_EMAIL}`);
    } else {
      console.error(`[PolicyChange] Fallback email failed:`, result.error);
    }
  } catch (emailError) {
    console.error('[PolicyChange] Fallback email error:', emailError);
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
