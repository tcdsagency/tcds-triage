import { db } from "../src/db";
import { tenants } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function update() {
  const clientId = "450";
  const clientSecret = "xZJ15GWdRzNFPhwYM5g4Fkz0U51IHA8F";
  const baseUrl = "https://tcds.al.3cx.us";
  const tenantId = "062c4693-96b2-4000-814b-04c2a334ebeb";

  console.log("Getting new 3CX token...");

  // Try to get token
  const tokenUrl = baseUrl + "/connect/token";
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  console.log("Token response:", response.status);
  const text = await response.text();

  if (response.status !== 200) {
    console.log("Error:", text);
    process.exit(1);
  }

  const tokenData = JSON.parse(text);
  console.log("Got new token, expires in:", tokenData.expires_in, "seconds");

  // Update database for specific tenant
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  if (!tenant) {
    console.log("Tenant not found:", tenantId);
    process.exit(1);
  }

  const integrations = (tenant.integrations as any) || {};

  integrations.threecx = {
    ...integrations.threecx,
    baseUrl,
    clientId,
    clientSecret,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    tokenExpiresAt: Date.now() + (tokenData.expires_in * 1000),
  };

  await db.update(tenants)
    .set({ integrations })
    .where(eq(tenants.id, tenantId));

  console.log("Updated 3CX config for tenant:", tenantId);

  // Test the callcontrol endpoint
  console.log("\nTesting /callcontrol/102 endpoint (ext 102)...");
  const testResponse = await fetch(baseUrl + "/callcontrol/102", {
    headers: {
      "Authorization": "Bearer " + tokenData.access_token,
    }
  });
  console.log("Status:", testResponse.status);
  const testText = await testResponse.text();
  console.log("Response:", testText.substring(0, 300));

  process.exit(0);
}

update();
