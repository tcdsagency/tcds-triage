/**
 * API Route: /api/policy-notices/webhook
 * =======================================
 * Webhook endpoint for receiving policy notices from Zapier (Adapt Insurance format).
 *
 * POST /api/policy-notices/webhook
 *
 * Adapt Insurance Payload Fields (via Zapier):
 * - ID: "bnot_cmk5iiugc16qqpgqt8pdq9rt6"
 * - Notice Type: "PENDING_CANCELLATION", "BILLING", etc.
 * - Notice Date: "2026-01-08"
 * - Notice Reason: "NON_PAYMENT"
 * - Named Insured: "DIAMOND THREATT"
 * - Due Date: "2026-01-23"
 * - Amount Due / Total Owed
 * - Policy Carrier: "ASI"
 * - Policy Policy Number: "ALA155456"
 * - Policy Line Of Business: "HOMEOWNERS"
 * - Policy Contact First Name / Last Name / Cell Phone
 * - Management System Fields Client Id: "18961:2944" (HawkSoft format)
 * - Management System Fields Policy Id: "2944:2"
 * - Insured Copy Document Url
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { policyNotices, customers, policies } from "@/db/schema";
import { eq, and, inArray, ne } from "drizzle-orm";

// Webhook secret for validation (optional but recommended)
const WEBHOOK_SECRET = process.env.POLICY_NOTICE_WEBHOOK_SECRET;

// =============================================================================
// Notice Type Mapping
// =============================================================================

function mapNoticeType(adaptType: string): "billing" | "policy" | "claim" {
  const type = adaptType?.toUpperCase() || "";

  if (type.includes("CANCEL") || type.includes("BILLING") || type.includes("PAYMENT") || type.includes("NON_PAYMENT")) {
    return "billing";
  }
  if (type.includes("CLAIM")) {
    return "claim";
  }
  return "policy";
}

function mapUrgency(adaptType: string, noticeReason: string, dueDate: string | null): "low" | "medium" | "high" | "urgent" {
  const type = adaptType?.toUpperCase() || "";
  const reason = noticeReason?.toUpperCase() || "";

  // Pending cancellation is urgent
  if (type.includes("CANCEL")) {
    return "urgent";
  }

  // Non-payment is high
  if (reason.includes("NON_PAYMENT")) {
    return "high";
  }

  // Check due date
  if (dueDate) {
    const due = new Date(dueDate);
    const now = new Date();
    const daysUntilDue = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return "urgent";
    if (daysUntilDue <= 3) return "high";
    if (daysUntilDue <= 7) return "medium";
  }

  return "medium";
}

// Extract HawkSoft client code from "18961:2944" format → "2944"
function extractHawkSoftClientCode(managementSystemClientId: string): string | null {
  if (!managementSystemClientId) return null;
  const parts = managementSystemClientId.split(":");
  return parts.length >= 2 ? parts[1] : parts[0];
}

// Check if notice type indicates policy was reinstated/rescinded
function isRescindedNotice(noticeType: string, noticeReason: string): boolean {
  const type = (noticeType || "").toUpperCase();
  const reason = (noticeReason || "").toUpperCase();

  const rescindKeywords = ["RESCIND", "REINSTATE", "REINSTATED", "RESCINDED", "CANCELLATION_RESCINDED", "CANCEL_RESCIND"];

  return rescindKeywords.some(keyword =>
    type.includes(keyword) || reason.includes(keyword)
  );
}

// Auto-resolve related pending notices when a rescinded notice comes in
async function autoResolveRelatedNotices(
  tenantId: string,
  policyNumber: string,
  newNoticeId: string,
  insuredName: string
): Promise<number> {
  if (!policyNumber) return 0;

  // Find pending notices for the same policy that are billing/cancellation related
  const relatedNotices = await db
    .select({ id: policyNotices.id, title: policyNotices.title })
    .from(policyNotices)
    .where(
      and(
        eq(policyNotices.tenantId, tenantId),
        eq(policyNotices.policyNumber, policyNumber),
        inArray(policyNotices.reviewStatus, ["pending", "assigned"]),
        ne(policyNotices.id, newNoticeId) // Don't resolve the new notice itself
      )
    );

  if (relatedNotices.length === 0) return 0;

  // Auto-resolve these notices
  const resolvedIds = relatedNotices.map(n => n.id);

  await db
    .update(policyNotices)
    .set({
      reviewStatus: "dismissed",
      actionTaken: "auto_resolved",
      actionDetails: `Auto-resolved: Cancellation rescinded notice received for policy ${policyNumber}. Customer ${insuredName} has reinstated coverage.`,
      actionedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(inArray(policyNotices.id, resolvedIds));

  console.log(`[Policy Notices] Auto-resolved ${resolvedIds.length} notices for policy ${policyNumber} due to rescinded notice`);

  return resolvedIds.length;
}

// =============================================================================
// POST - Receive Policy Notice from Zapier (Adapt Format)
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Optional: Validate webhook secret
    if (WEBHOOK_SECRET) {
      const authHeader = request.headers.get("authorization");
      const providedSecret = authHeader?.replace("Bearer ", "");
      if (providedSecret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Handle both JSON and form-urlencoded data from Zapier
    const contentType = request.headers.get("content-type") || "";
    let payload: Record<string, any>;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Parse URL-encoded form data
      const formData = await request.formData();
      payload = {};
      formData.forEach((value, key) => {
        payload[key] = value;
      });
    } else if (contentType.includes("form-data")) {
      // Parse multipart form data
      const formData = await request.formData();
      payload = {};
      formData.forEach((value, key) => {
        payload[key] = value;
      });
    } else {
      // Parse JSON
      payload = await request.json();
    }

    // Extract fields from Adapt format (Zapier flattens nested objects with spaces)
    const adaptNoticeId = payload["ID"] || payload["id"] || null;
    const noticeTypeRaw = payload["Notice Type"] || payload["noticeType"] || "BILLING";
    const noticeReason = payload["Notice Reason"] || payload["noticeReason"] || "";
    const namedInsured = payload["Named Insured"] || payload["namedInsured"] || "";
    const noticeDate = payload["Notice Date"] || payload["noticeDate"] || null;
    const dueDate = payload["Due Date"] || payload["dueDate"] || null;
    const amountDue = payload["Amount Due"] || payload["Total Owed"] || payload["amountDue"] || null;
    const effectiveDate = payload["Effective Date"] || payload["effectiveDate"] || null;

    // Policy fields (Zapier flattens with "Policy " prefix)
    const carrier = payload["Policy Carrier"] || payload["policy"]?.["Policy Carrier"] || payload["carrier"] || null;
    const policyNumber = payload["Policy Policy Number"] || payload["policy"]?.["Policy Policy Number"] || payload["policyNumber"] || null;
    const lineOfBusiness = payload["Policy Line Of Business"] || payload["policy"]?.["Policy Line Of Business"] || payload["lineOfBusiness"] || null;

    // Contact fields
    const contactFirstName = payload["Policy Contact First Name"] || payload["contact"]?.["Policy Contact First Name"] || "";
    const contactLastName = payload["Policy Contact Last Name"] || payload["contact"]?.["Policy Contact Last Name"] || "";
    const contactPhone = payload["Policy Contact Cell Phone"] || payload["contact"]?.["Policy Contact Cell Phone"] || "";

    // HawkSoft Management System Fields
    const hsClientId = payload["Management System Fields Client Id"] ||
                       payload["managementSystemFields"]?.["Management System Fields Client Id"] || null;
    const hsPolicyId = payload["Management System Fields Policy Id"] ||
                       payload["managementSystemFields"]?.["Management System Fields Policy Id"] || null;

    // Document URL
    const documentUrl = payload["Insured Copy Document Url"] ||
                        payload["insuredCopyDocument"]?.["Insured Copy Document Url"] || null;

    // Validate required fields
    if (!noticeTypeRaw) {
      return NextResponse.json({ error: "Notice Type is required" }, { status: 400 });
    }

    // Check for duplicate
    if (adaptNoticeId) {
      const existing = await db
        .select({ id: policyNotices.id })
        .from(policyNotices)
        .where(eq(policyNotices.adaptNoticeId, adaptNoticeId))
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json({
          success: true,
          message: "Notice already exists",
          noticeId: existing[0].id,
          duplicate: true,
        });
      }
    }

    // Try to match customer by HawkSoft client code
    let matchedCustomerId: string | null = null;
    let matchedPolicyId: string | null = null;

    const hawkSoftClientCode = extractHawkSoftClientCode(hsClientId);

    if (hawkSoftClientCode) {
      const matchedCustomer = await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            eq(customers.hawksoftClientCode, hawkSoftClientCode)
          )
        )
        .limit(1);

      if (matchedCustomer.length > 0) {
        matchedCustomerId = matchedCustomer[0].id;

        // Also try to match the policy
        if (policyNumber && matchedCustomerId) {
          const matchedPolicy = await db
            .select({ id: policies.id })
            .from(policies)
            .where(
              and(
                eq(policies.customerId, matchedCustomerId),
                eq(policies.policyNumber, policyNumber)
              )
            )
            .limit(1);

          if (matchedPolicy.length > 0) {
            matchedPolicyId = matchedPolicy[0].id;
          }
        }
      }
    }

    // Map notice type and calculate urgency
    const noticeType = mapNoticeType(noticeTypeRaw);
    const urgency = mapUrgency(noticeTypeRaw, noticeReason, dueDate);

    // Build title from notice type and reason
    const titleParts = [noticeTypeRaw.replace(/_/g, " ")];
    if (noticeReason && noticeReason !== noticeTypeRaw) {
      titleParts.push(`(${noticeReason.replace(/_/g, " ")})`);
    }
    const title = titleParts.join(" ");

    // Build description
    const descriptionParts = [];
    if (namedInsured) descriptionParts.push(`Insured: ${namedInsured}`);
    if (policyNumber) descriptionParts.push(`Policy: ${policyNumber}`);
    if (carrier) descriptionParts.push(`Carrier: ${carrier}`);
    if (amountDue) descriptionParts.push(`Amount: $${amountDue}`);
    if (dueDate) descriptionParts.push(`Due: ${dueDate}`);
    if (documentUrl) descriptionParts.push(`Document: ${documentUrl}`);
    const description = descriptionParts.join("\n");

    // Determine insured name - use contact names if available, otherwise Named Insured
    const insuredName = (contactFirstName && contactLastName)
      ? `${contactFirstName} ${contactLastName}`.trim()
      : namedInsured;

    // Create the notice
    const [newNotice] = await db
      .insert(policyNotices)
      .values({
        tenantId,
        adaptNoticeId,
        noticeType,
        urgency,
        policyNumber,
        insuredName,
        carrier,
        lineOfBusiness: lineOfBusiness?.toLowerCase() || null,
        customerId: matchedCustomerId,
        policyId: matchedPolicyId,
        title,
        description,
        amountDue: amountDue ? amountDue.toString().replace(/[^0-9.]/g, '') : null,
        dueDate,
        gracePeriodEnd: effectiveDate || null, // Effective date of cancellation as grace period end
        reviewStatus: "pending",
        noticeDate: noticeDate ? new Date(noticeDate) : new Date(),
        rawPayload: payload,
        fetchedAt: new Date(),
      })
      .returning({ id: policyNotices.id });

    // Auto-resolve related notices if this is a "rescinded" or "reinstated" notice
    let autoResolvedCount = 0;
    if (isRescindedNotice(noticeTypeRaw, noticeReason) && policyNumber) {
      autoResolvedCount = await autoResolveRelatedNotices(
        tenantId,
        policyNumber,
        newNotice.id,
        insuredName
      );

      // Also mark the rescinded notice itself as auto-actioned (it's informational)
      await db
        .update(policyNotices)
        .set({
          reviewStatus: "actioned",
          actionTaken: "auto_resolved",
          actionDetails: `Cancellation rescinded - policy reinstated. ${autoResolvedCount} related notice(s) were also auto-resolved.`,
          actionedAt: new Date(),
        })
        .where(eq(policyNotices.id, newNotice.id));
    }

    return NextResponse.json({
      success: true,
      noticeId: newNotice.id,
      matched: {
        customerId: matchedCustomerId,
        policyId: matchedPolicyId,
        hawkSoftClientCode,
      },
      parsed: {
        noticeType,
        urgency,
        title,
        insuredName,
        policyNumber,
        carrier,
      },
      autoResolved: autoResolvedCount > 0 ? {
        count: autoResolvedCount,
        message: `Auto-resolved ${autoResolvedCount} related pending notice(s) for policy ${policyNumber}`,
      } : undefined,
    });
  } catch (error) {
    console.error("Policy notice webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process notice" },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Health check / webhook info
// =============================================================================

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/policy-notices/webhook",
    method: "POST",
    authentication: WEBHOOK_SECRET ? "Bearer token required" : "No authentication required",
    format: "Adapt Insurance (via Zapier)",
    fieldMapping: {
      "ID": "adaptNoticeId (deduplication)",
      "Notice Type": "noticeType (PENDING_CANCELLATION → billing)",
      "Notice Reason": "Used in title",
      "Named Insured": "insuredName",
      "Notice Date": "noticeDate",
      "Due Date": "dueDate",
      "Amount Due / Total Owed": "amountDue",
      "Policy Carrier": "carrier",
      "Policy Policy Number": "policyNumber",
      "Policy Line Of Business": "lineOfBusiness",
      "Policy Contact First Name / Last Name": "Preferred for insuredName",
      "Management System Fields Client Id": "HawkSoft client code for customer matching",
      "Management System Fields Policy Id": "HawkSoft policy ID",
    },
  });
}
