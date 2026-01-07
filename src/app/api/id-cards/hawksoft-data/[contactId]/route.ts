// API Route: /api/id-cards/hawksoft-data/[contactId]
// Fetch HawkSoft policy data for a customer (by AgencyZoom ID)

import { NextRequest, NextResponse } from "next/server";
import { getHawkSoftClient, FULL_CLIENT_INCLUDES, FULL_CLIENT_EXPANDS } from "@/lib/api/hawksoft";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

interface RouteParams {
  params: Promise<{ contactId: string }>;
}

// Auto-policy line of business keywords
const AUTO_LOB_KEYWORDS = [
  "pa", "ppa", "auto", "motor", "vehicle", "car",
  "boat", "rv", "mc", "motorcycle", "recreational",
  "commercial auto", "truck", "fleet"
];

function isAutoPolicy(policy: any): boolean {
  // Check line of business
  const lob = (policy.lineOfBusiness || policy.policyType || "").toLowerCase();
  if (AUTO_LOB_KEYWORDS.some((kw) => lob.includes(kw))) {
    return true;
  }

  // Check if has vehicles
  if (policy.vehicles && policy.vehicles.length > 0) {
    return true;
  }
  if (policy.autos && policy.autos.length > 0) {
    return true;
  }

  return false;
}

function isPolicyActive(policy: any): boolean {
  const status = (policy.status || "").toLowerCase();
  if (status === "active" || status === "in force" || status === "inforce") {
    return true;
  }

  // Check expiration date
  if (policy.expirationDate) {
    const expDate = new Date(policy.expirationDate);
    return expDate >= new Date();
  }

  return false;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { contactId } = await params;
    const { searchParams } = new URL(request.url);
    const contactType = searchParams.get("type") || "customer";

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    let hawksoftClientNumber: string | null = null;
    let insuredName = "";
    let email = "";
    let phone = "";
    let isDirectHawkSoftLookup = false;

    // Check if this is a direct HawkSoft client number lookup (hawksoft-{clientNumber})
    if (contactId.startsWith("hawksoft-")) {
      hawksoftClientNumber = contactId.replace("hawksoft-", "");
      isDirectHawkSoftLookup = true;
      console.log("[ID Cards] Direct HawkSoft lookup:", hawksoftClientNumber);
    } else {
      // Get HawkSoft client number from AgencyZoom
      const azClient = getAgencyZoomClient();

      try {
        if (contactType === "customer") {
          const customer = await azClient.getCustomer(parseInt(contactId));
          hawksoftClientNumber = customer.externalId || null;
          insuredName = `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
          email = customer.email || "";
          phone = customer.phone || customer.phoneCell || "";
        } else {
          const lead = await azClient.getLead(parseInt(contactId));
          hawksoftClientNumber = (lead as any).externalId || null;
          insuredName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim();
          email = lead.email || "";
          phone = lead.phone || (lead as any).phoneCell || "";
        }
      } catch (azError) {
        console.error("[ID Cards] AgencyZoom lookup error:", azError);
        return NextResponse.json({
          success: false,
          error: "Failed to look up contact in AgencyZoom",
        }, { status: 404 });
      }

      if (!hawksoftClientNumber) {
        return NextResponse.json({
          success: true,
          externalId: null,
          insuredName,
          email,
          phone,
          policies: [],
          message: "No HawkSoft client number linked to this contact",
        });
      }
    }

    // Fetch from HawkSoft
    const hsClient = getHawkSoftClient();
    let hsData;

    try {
      hsData = await hsClient.getClient(
        parseInt(hawksoftClientNumber),
        FULL_CLIENT_INCLUDES,
        FULL_CLIENT_EXPANDS
      );
    } catch (hsError) {
      console.error("[ID Cards] HawkSoft lookup error:", hsError);
      return NextResponse.json({
        success: false,
        error: "Failed to fetch data from HawkSoft",
        externalId: hawksoftClientNumber,
      }, { status: 500 });
    }

    // Format policies
    const policies = (hsData.policies || []).map((policy: any) => {
      // Get vehicles from policy.autos or policy.vehicles
      const vehicles = (policy.autos || policy.vehicles || []).map((v: any) => ({
        year: String(v.year || v.Year || ""),
        make: v.make || v.Make || "",
        model: v.model || v.Model || "",
        vin: v.vin || v.VIN || v.Vin || "",
      }));

      // Get drivers
      const drivers = (policy.drivers || []).map((d: any) => ({
        name: `${d.firstName || ""} ${d.lastName || ""}`.trim(),
        info: d.licenseNumber ? `License: ${d.licenseNumber}` : undefined,
      }));

      const isActive = isPolicyActive(policy);
      const isAuto = isAutoPolicy(policy);

      return {
        policyId: policy.policyId,
        carrier: policy.carrier || "Unknown Carrier",
        naic: policy.carrierNaic || policy.naic || "",
        policyNumber: policy.policyNumber,
        effectiveDate: policy.effectiveDate,
        expirationDate: policy.expirationDate,
        status: policy.status,
        isActive,
        lineOfBusiness: policy.lineOfBusiness || policy.policyType || "",
        isAutoPolicy: isAuto,
        vehicles,
        drivers,
      };
    });

    // Sort: auto policies first, then active, then by expiration
    policies.sort((a: any, b: any) => {
      // Auto policies first
      if (a.isAutoPolicy && !b.isAutoPolicy) return -1;
      if (!a.isAutoPolicy && b.isAutoPolicy) return 1;
      // Active first
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      // By expiration date
      return new Date(b.expirationDate).getTime() - new Date(a.expirationDate).getTime();
    });

    // Build address from HawkSoft data
    const address = hsData.address ? {
      line1: hsData.address.line1 || "",
      line2: hsData.address.line2 || "",
      city: hsData.address.city || "",
      state: hsData.address.state || "",
      zip: hsData.address.zip || "",
    } : null;

    return NextResponse.json({
      success: true,
      externalId: hawksoftClientNumber,
      isDirectHawkSoftLookup,
      insuredName: hsData.displayName || hsData.fullName || `${hsData.firstName || ""} ${hsData.lastName || ""}`.trim() || insuredName,
      email: hsData.email || email,
      phone: hsData.phone || hsData.phoneCell || phone,
      address,
      policies,
    });
  } catch (error: any) {
    console.error("[ID Cards] HawkSoft data error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch HawkSoft data", details: error.message },
      { status: 500 }
    );
  }
}
