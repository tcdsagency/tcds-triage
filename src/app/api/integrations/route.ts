import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

// Integration definitions with required fields
const INTEGRATION_CONFIGS: Record<string, {
  name: string;
  description: string;
  category: string;
  fields: { key: string; label: string; type: "text" | "password" | "url"; required: boolean; placeholder?: string }[];
  testEndpoint?: string;
}> = {
  agencyzoom: {
    name: "AgencyZoom",
    description: "CRM - leads, customers, notes, tasks",
    category: "CRM",
    fields: [
      { key: "username", label: "Username/Email", type: "text", required: true, placeholder: "user@agency.com" },
      { key: "password", label: "Password", type: "password", required: true },
    ],
  },
  hawksoft: {
    name: "HawkSoft",
    description: "AMS - policies, coverages, claims (READ-ONLY)",
    category: "AMS",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", required: true },
      { key: "agencyId", label: "Agency ID", type: "text", required: true },
    ],
  },
  threecx: {
    name: "3CX Native API",
    description: "Phone system - OAuth2 call control, real-time events",
    category: "Phone",
    fields: [
      { key: "baseUrl", label: "Server URL", type: "url", required: true, placeholder: "https://your-pbx.3cx.com" },
      { key: "clientId", label: "OAuth2 Client ID", type: "text", required: true, placeholder: "From 3CX Admin > Integrations" },
      { key: "clientSecret", label: "OAuth2 Client Secret", type: "password", required: true },
      { key: "jwtPublicKey", label: "JWT Public Key", type: "password", required: false, placeholder: "For webhook verification" },
      { key: "extension", label: "Default Extension", type: "text", required: false },
    ],
  },
  voiptools: {
    name: "VoIPTools Relay",
    description: "Presence management middleware (separate from 3CX)",
    category: "Phone",
    fields: [
      { key: "relayUrl", label: "Relay Server URL", type: "url", required: true, placeholder: "https://vt-relay.yourdomain.com:5656" },
      { key: "jwtToken", label: "JWT Token", type: "password", required: true },
    ],
  },
  vmbridge: {
    name: "VM Bridge",
    description: "Real-time audio capture & transcription",
    category: "Phone",
    fields: [
      { key: "bridgeUrl", label: "Bridge Server URL", type: "url", required: true, placeholder: "https://vmbridge.yourdomain.com:5050" },
      { key: "apiKey", label: "API Key (optional)", type: "password", required: false },
    ],
  },
  mssql: {
    name: "MSSQL Transcripts",
    description: "SQL Server for post-call transcript storage",
    category: "Phone",
    fields: [
      { key: "server", label: "Server Host", type: "text", required: true, placeholder: "sql.yourdomain.com" },
      { key: "port", label: "Port", type: "text", required: false, placeholder: "1433" },
      { key: "database", label: "Database Name", type: "text", required: true, placeholder: "transcription_db" },
      { key: "user", label: "Username", type: "text", required: true },
      { key: "password", label: "Password", type: "password", required: true },
      { key: "encrypt", label: "Use Encryption", type: "text", required: false, placeholder: "true or false" },
    ],
  },
  twilio: {
    name: "Twilio",
    description: "SMS sending/receiving",
    category: "Phone",
    fields: [
      { key: "accountSid", label: "Account SID", type: "text", required: true, placeholder: "ACxxxx..." },
      { key: "authToken", label: "Auth Token", type: "password", required: true },
      { key: "phoneNumber", label: "Phone Number", type: "text", required: true, placeholder: "+1234567890" },
    ],
  },
  deepgram: {
    name: "Deepgram",
    description: "Real-time transcription",
    category: "AI",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", required: true },
    ],
  },
  openai: {
    name: "OpenAI",
    description: "AI summaries, chat, analysis (GPT-4o)",
    category: "AI",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", required: true, placeholder: "sk-..." },
      { key: "model", label: "Default Model", type: "text", required: false, placeholder: "gpt-4o" },
    ],
  },
  anthropic: {
    name: "Anthropic",
    description: "Claude AI - complex reasoning",
    category: "AI",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", required: true, placeholder: "sk-ant-..." },
    ],
  },
  nearmap: {
    name: "Nearmap",
    description: "Aerial imagery, roof analysis",
    category: "Property",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", required: true },
    ],
  },
  rpr: {
    name: "RPR (Realtors Property Resource)",
    description: "Property construction, owner data",
    category: "Property",
    fields: [
      { key: "username", label: "Username", type: "text", required: true },
      { key: "password", label: "Password", type: "password", required: true },
    ],
  },
  resend: {
    name: "Resend",
    description: "Email delivery service",
    category: "Email",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", required: true, placeholder: "re_..." },
      { key: "fromEmail", label: "From Email", type: "text", required: false, placeholder: "noreply@yourdomain.com" },
    ],
  },
  pinecone: {
    name: "Pinecone",
    description: "Vector database for semantic search",
    category: "AI",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", required: true },
      { key: "environment", label: "Environment", type: "text", required: true, placeholder: "us-east-1" },
      { key: "indexName", label: "Index Name", type: "text", required: false },
    ],
  },
  smartystreets: {
    name: "SmartyStreets",
    description: "Address validation/autocomplete",
    category: "Data",
    fields: [
      { key: "authId", label: "Auth ID", type: "text", required: true },
      { key: "authToken", label: "Auth Token", type: "password", required: true },
    ],
  },
  google: {
    name: "Google",
    description: "Places API, Maps, Reviews",
    category: "Data",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", required: true },
      { key: "placeId", label: "Google Place ID (for reviews)", type: "text", required: false },
    ],
  },
  canopy: {
    name: "Canopy Connect",
    description: "Insurance verification, policy pull, carrier data",
    category: "Data",
    fields: [
      { key: "clientId", label: "Client ID", type: "text", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", required: true },
      { key: "environment", label: "Environment", type: "text", required: false, placeholder: "sandbox or production" },
    ],
  },
};

// Mask sensitive values for display
function maskValue(value: string): string {
  if (!value || value.length < 8) return "********";
  return value.substring(0, 4) + "****" + value.substring(value.length - 4);
}

// =============================================================================
// GET /api/integrations - Get all integration configs and current values
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Get tenant's stored integrations
    const [tenant] = await db
      .select({ integrations: tenants.integrations })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const storedIntegrations = (tenant?.integrations as Record<string, any>) || {};

    // Build response with configs and current values (masked)
    const integrations = Object.entries(INTEGRATION_CONFIGS).map(([id, config]) => {
      const stored = storedIntegrations[id] || {};
      const isConfigured = config.fields.every(f => !f.required || stored[f.key]);

      // Check environment variables as fallback
      const envConfigured = checkEnvConfig(id);

      return {
        id,
        ...config,
        isConfigured: isConfigured || envConfigured,
        configSource: isConfigured ? "database" : (envConfigured ? "environment" : "none"),
        values: config.fields.reduce((acc, field) => {
          const value = stored[field.key];
          acc[field.key] = {
            isSet: !!value || checkEnvField(id, field.key),
            maskedValue: value ? maskValue(value) : (checkEnvField(id, field.key) ? "(env)" : ""),
          };
          return acc;
        }, {} as Record<string, { isSet: boolean; maskedValue: string }>),
      };
    });

    // Group by category
    const categories = [...new Set(Object.values(INTEGRATION_CONFIGS).map(c => c.category))];
    const grouped = categories.map(category => ({
      category,
      integrations: integrations.filter(i => i.category === category),
    }));

    return NextResponse.json({
      success: true,
      integrations,
      grouped,
    });
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/integrations - Update integration credentials
// =============================================================================
export async function PUT(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const body = await request.json();
    const { integrationId, credentials } = body;

    if (!integrationId || !INTEGRATION_CONFIGS[integrationId]) {
      return NextResponse.json(
        { success: false, error: "Invalid integration ID" },
        { status: 400 }
      );
    }

    // Get current integrations
    const [tenant] = await db
      .select({ integrations: tenants.integrations })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const currentIntegrations = (tenant?.integrations as Record<string, any>) || {};

    // Update the specific integration
    const updatedIntegrations = {
      ...currentIntegrations,
      [integrationId]: {
        ...currentIntegrations[integrationId],
        ...credentials,
        updatedAt: new Date().toISOString(),
      },
    };

    // Save to database
    await db
      .update(tenants)
      .set({
        integrations: updatedIntegrations,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    return NextResponse.json({
      success: true,
      message: `${INTEGRATION_CONFIGS[integrationId].name} credentials updated`,
    });
  } catch (error) {
    console.error("Error updating integration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update integration" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/integrations - Remove integration credentials
// =============================================================================
export async function DELETE(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get("id");

    if (!integrationId || !INTEGRATION_CONFIGS[integrationId]) {
      return NextResponse.json(
        { success: false, error: "Invalid integration ID" },
        { status: 400 }
      );
    }

    // Get current integrations
    const [tenant] = await db
      .select({ integrations: tenants.integrations })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const currentIntegrations = (tenant?.integrations as Record<string, any>) || {};

    // Remove the specific integration
    delete currentIntegrations[integrationId];

    // Save to database
    await db
      .update(tenants)
      .set({
        integrations: currentIntegrations,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    return NextResponse.json({
      success: true,
      message: `${INTEGRATION_CONFIGS[integrationId].name} credentials removed`,
    });
  } catch (error) {
    console.error("Error removing integration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove integration" },
      { status: 500 }
    );
  }
}

// Helper: Check if integration has env variables configured
function checkEnvConfig(integrationId: string): boolean {
  const envMappings: Record<string, string[]> = {
    agencyzoom: ["AGENCYZOOM_API_USERNAME", "AGENCYZOOM_API_PASSWORD"],
    hawksoft: ["HAWKSOFT_API_KEY"],
    threecx: ["THREECX_CLIENT_ID", "THREECX_CLIENT_SECRET"],
    voiptools: ["VOIPTOOLS_RELAY_URL", "VOIPTOOLS_JWT_TOKEN"],
    vmbridge: ["VMBRIDGE_URL"],
    mssql: ["MSSQL_SERVER", "MSSQL_DATABASE", "MSSQL_USER", "MSSQL_PASSWORD"],
    twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
    deepgram: ["DEEPGRAM_API_KEY"],
    openai: ["OPENAI_API_KEY"],
    anthropic: ["ANTHROPIC_API_KEY"],
    nearmap: ["NEARMAP_API_KEY"],
    resend: ["RESEND_API_KEY"],
    pinecone: ["PINECONE_API_KEY"],
    google: ["GOOGLE_API_KEY"],
    canopy: ["CANOPY_CLIENT_ID", "CANOPY_CLIENT_SECRET"],
  };

  const keys = envMappings[integrationId] || [];
  return keys.some(key => !!process.env[key]);
}

// Helper: Check if specific field has env variable
function checkEnvField(integrationId: string, fieldKey: string): boolean {
  const envMappings: Record<string, Record<string, string>> = {
    agencyzoom: { username: "AGENCYZOOM_API_USERNAME", password: "AGENCYZOOM_API_PASSWORD" },
    hawksoft: { apiKey: "HAWKSOFT_API_KEY", agencyId: "HAWKSOFT_AGENCY_ID" },
    threecx: {
      baseUrl: "THREECX_BASE_URL",
      clientId: "THREECX_CLIENT_ID",
      clientSecret: "THREECX_CLIENT_SECRET",
      jwtPublicKey: "THREECX_JWT_PUBLIC_KEY",
    },
    voiptools: {
      relayUrl: "VOIPTOOLS_RELAY_URL",
      jwtToken: "VOIPTOOLS_JWT_TOKEN",
    },
    vmbridge: {
      bridgeUrl: "VMBRIDGE_URL",
      apiKey: "VMBRIDGE_API_KEY",
    },
    mssql: {
      server: "MSSQL_SERVER",
      port: "MSSQL_PORT",
      database: "MSSQL_DATABASE",
      user: "MSSQL_USER",
      password: "MSSQL_PASSWORD",
      encrypt: "MSSQL_ENCRYPT",
    },
    twilio: { accountSid: "TWILIO_ACCOUNT_SID", authToken: "TWILIO_AUTH_TOKEN", phoneNumber: "TWILIO_PHONE_NUMBER" },
    deepgram: { apiKey: "DEEPGRAM_API_KEY" },
    openai: { apiKey: "OPENAI_API_KEY" },
    anthropic: { apiKey: "ANTHROPIC_API_KEY" },
    nearmap: { apiKey: "NEARMAP_API_KEY" },
    resend: { apiKey: "RESEND_API_KEY" },
    pinecone: { apiKey: "PINECONE_API_KEY", environment: "PINECONE_ENVIRONMENT" },
    google: { apiKey: "GOOGLE_API_KEY" },
    canopy: { clientId: "CANOPY_CLIENT_ID", clientSecret: "CANOPY_CLIENT_SECRET", environment: "CANOPY_ENVIRONMENT" },
  };

  const mapping = envMappings[integrationId];
  if (!mapping) return false;

  const envKey = mapping[fieldKey];
  return envKey ? !!process.env[envKey] : false;
}
