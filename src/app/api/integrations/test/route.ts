import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// POST /api/integrations/test - Test an integration connection
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { integrationId, credentials } = body;

    // Use provided credentials or fetch from database
    let testCredentials = credentials;

    if (!testCredentials) {
      const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
      const [tenant] = await db
        .select({ integrations: tenants.integrations })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      const storedIntegrations = (tenant?.integrations as Record<string, any>) || {};
      testCredentials = storedIntegrations[integrationId];
    }

    // Run integration-specific test
    const result = await testIntegration(integrationId, testCredentials);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error testing integration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to test integration" },
      { status: 500 }
    );
  }
}

async function testIntegration(
  integrationId: string,
  credentials: Record<string, string> | undefined
): Promise<{ success: boolean; message: string; details?: any }> {
  // Check environment variables as fallback
  const envCreds = getEnvCredentials(integrationId);
  const creds = { ...envCreds, ...credentials };

  switch (integrationId) {
    case "openai":
      return testOpenAI(creds);
    case "anthropic":
      return testAnthropic(creds);
    case "twilio":
      return testTwilio(creds);
    case "resend":
      return testResend(creds);
    case "agencyzoom":
      return testAgencyZoom(creds);
    case "hawksoft":
      return testHawkSoft(creds);
    case "deepgram":
      return testDeepgram(creds);
    case "nearmap":
      return testNearmap(creds);
    case "google":
      return testGoogle(creds);
    case "canopy":
      return testCanopy(creds);
    default:
      return { success: false, message: "Test not implemented for this integration" };
  }
}

// Get credentials from environment variables
function getEnvCredentials(integrationId: string): Record<string, string> {
  const creds: Record<string, string> = {};

  switch (integrationId) {
    case "openai":
      if (process.env.OPENAI_API_KEY) creds.apiKey = process.env.OPENAI_API_KEY;
      break;
    case "anthropic":
      if (process.env.ANTHROPIC_API_KEY) creds.apiKey = process.env.ANTHROPIC_API_KEY;
      break;
    case "twilio":
      if (process.env.TWILIO_ACCOUNT_SID) creds.accountSid = process.env.TWILIO_ACCOUNT_SID;
      if (process.env.TWILIO_AUTH_TOKEN) creds.authToken = process.env.TWILIO_AUTH_TOKEN;
      if (process.env.TWILIO_PHONE_NUMBER) creds.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
      break;
    case "resend":
      if (process.env.RESEND_API_KEY) creds.apiKey = process.env.RESEND_API_KEY;
      break;
    case "agencyzoom":
      if (process.env.AGENCYZOOM_API_USERNAME) creds.username = process.env.AGENCYZOOM_API_USERNAME;
      if (process.env.AGENCYZOOM_API_PASSWORD) creds.password = process.env.AGENCYZOOM_API_PASSWORD;
      break;
    case "hawksoft":
      if (process.env.HAWKSOFT_API_KEY) creds.apiKey = process.env.HAWKSOFT_API_KEY;
      if (process.env.HAWKSOFT_AGENCY_ID) creds.agencyId = process.env.HAWKSOFT_AGENCY_ID;
      break;
    case "deepgram":
      if (process.env.DEEPGRAM_API_KEY) creds.apiKey = process.env.DEEPGRAM_API_KEY;
      break;
    case "nearmap":
      if (process.env.NEARMAP_API_KEY) creds.apiKey = process.env.NEARMAP_API_KEY;
      break;
    case "google":
      if (process.env.GOOGLE_API_KEY) creds.apiKey = process.env.GOOGLE_API_KEY;
      break;
    case "canopy":
      if (process.env.CANOPY_CLIENT_ID) creds.clientId = process.env.CANOPY_CLIENT_ID;
      if (process.env.CANOPY_CLIENT_SECRET) creds.clientSecret = process.env.CANOPY_CLIENT_SECRET;
      if (process.env.CANOPY_ENVIRONMENT) creds.environment = process.env.CANOPY_ENVIRONMENT;
      break;
  }

  return creds;
}

// Test functions for each integration

async function testOpenAI(creds: Record<string, string>): Promise<{ success: boolean; message: string; details?: any }> {
  if (!creds.apiKey) {
    return { success: false, message: "API key not configured" };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: "Connection successful",
        details: { modelsAvailable: data.data?.length || 0 },
      };
    } else {
      const error = await response.text();
      return { success: false, message: `API error: ${response.status}`, details: { error } };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Connection failed" };
  }
}

async function testAnthropic(creds: Record<string, string>): Promise<{ success: boolean; message: string; details?: any }> {
  if (!creds.apiKey) {
    return { success: false, message: "API key not configured" };
  }

  try {
    // Anthropic doesn't have a simple test endpoint, so we'll just validate the key format
    if (creds.apiKey.startsWith("sk-ant-")) {
      return { success: true, message: "API key format valid" };
    }
    return { success: false, message: "Invalid API key format" };
  } catch (error: any) {
    return { success: false, message: error.message || "Connection failed" };
  }
}

async function testTwilio(creds: Record<string, string>): Promise<{ success: boolean; message: string; details?: any }> {
  if (!creds.accountSid || !creds.authToken) {
    return { success: false, message: "Account SID and Auth Token required" };
  }

  try {
    const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}.json`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: "Connection successful",
        details: { accountName: data.friendly_name, status: data.status },
      };
    } else {
      return { success: false, message: `API error: ${response.status}` };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Connection failed" };
  }
}

async function testResend(creds: Record<string, string>): Promise<{ success: boolean; message: string; details?: any }> {
  if (!creds.apiKey) {
    return { success: false, message: "API key not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: "Connection successful",
        details: { domainsConfigured: data.data?.length || 0 },
      };
    } else {
      const error = await response.text();
      return { success: false, message: `API error: ${response.status}`, details: { error } };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Connection failed" };
  }
}

async function testAgencyZoom(creds: Record<string, string>): Promise<{ success: boolean; message: string; details?: any }> {
  if (!creds.username || !creds.password) {
    return { success: false, message: "Username and password required" };
  }

  try {
    const response = await fetch("https://api.agencyzoom.com/v1/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: creds.username,
        password: creds.password,
        version: "1.0",
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: "Authentication successful",
        details: { hasToken: !!data.jwt },
      };
    } else {
      return { success: false, message: `Authentication failed: ${response.status}` };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Connection failed" };
  }
}

async function testHawkSoft(creds: Record<string, string>): Promise<{ success: boolean; message: string; details?: any }> {
  if (!creds.apiKey) {
    return { success: false, message: "API key not configured" };
  }

  // HawkSoft Partner API test
  try {
    const response = await fetch("https://partner-api.hawksoft.com/vendor/agencies", {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: "Connection successful",
        details: { agenciesSubscribed: data.agencyIds?.length || 0 },
      };
    } else {
      return { success: false, message: `API error: ${response.status}` };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Connection failed" };
  }
}

async function testDeepgram(creds: Record<string, string>): Promise<{ success: boolean; message: string; details?: any }> {
  if (!creds.apiKey) {
    return { success: false, message: "API key not configured" };
  }

  try {
    const response = await fetch("https://api.deepgram.com/v1/projects", {
      headers: { Authorization: `Token ${creds.apiKey}` },
    });

    if (response.ok) {
      return { success: true, message: "Connection successful" };
    } else {
      return { success: false, message: `API error: ${response.status}` };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Connection failed" };
  }
}

async function testNearmap(creds: Record<string, string>): Promise<{ success: boolean; message: string; details?: any }> {
  if (!creds.apiKey) {
    return { success: false, message: "API key not configured" };
  }

  // Nearmap coverage check (simple test)
  try {
    const response = await fetch(
      `https://api.nearmap.com/coverage/v2/point/-97.7431,30.2672?apikey=${creds.apiKey}`
    );

    if (response.ok) {
      return { success: true, message: "Connection successful" };
    } else {
      return { success: false, message: `API error: ${response.status}` };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Connection failed" };
  }
}

async function testGoogle(creds: Record<string, string>): Promise<{ success: boolean; message: string; details?: any }> {
  if (!creds.apiKey) {
    return { success: false, message: "API key not configured" };
  }

  try {
    // Test with a simple geocoding request
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=${creds.apiKey}`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.status === "OK") {
        return { success: true, message: "Connection successful" };
      } else if (data.status === "REQUEST_DENIED") {
        return { success: false, message: "API key invalid or restricted" };
      }
      return { success: false, message: `API status: ${data.status}` };
    } else {
      return { success: false, message: `API error: ${response.status}` };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Connection failed" };
  }
}

async function testCanopy(creds: Record<string, string>): Promise<{ success: boolean; message: string; details?: any }> {
  if (!creds.clientId || !creds.clientSecret) {
    return { success: false, message: "Client ID and Client Secret required" };
  }

  try {
    // Canopy Connect uses OAuth2 - try to get an access token
    const environment = creds.environment || "sandbox";
    const baseUrl = environment === "production"
      ? "https://api.usecanopy.com"
      : "https://sandbox-api.usecanopy.com";

    const response = await fetch(`${baseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: "Authentication successful",
        details: { hasAccessToken: !!data.access_token, environment },
      };
    } else {
      const error = await response.text();
      return { success: false, message: `Authentication failed: ${response.status}`, details: { error } };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Connection failed" };
  }
}
