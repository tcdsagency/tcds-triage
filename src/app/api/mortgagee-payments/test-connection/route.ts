import { NextResponse } from "next/server";
import { db } from "@/db";
import { mortgageePaymentSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/mortgagee-payments/test-connection
 * Server-side proxy to test microservice connectivity (avoids CORS)
 */
export async function POST() {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, message: "Tenant not configured" },
        { status: 500 }
      );
    }

    const [settings] = await db
      .select()
      .from(mortgageePaymentSettings)
      .where(eq(mortgageePaymentSettings.tenantId, tenantId))
      .limit(1);

    if (!settings?.microserviceUrl) {
      return NextResponse.json({
        success: false,
        message: "Microservice URL not configured",
      });
    }

    const res = await fetch(`${settings.microserviceUrl}/health`, {
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        success: true,
        message: `Connected! Service: ${data.service} v${data.version}, CAPTCHA: ${data.captcha_configured ? "Yes" : "No"}`,
      });
    } else {
      return NextResponse.json({
        success: false,
        message: `Connection failed: HTTP ${res.status}`,
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: `Connection failed: ${error.message}`,
    });
  }
}
