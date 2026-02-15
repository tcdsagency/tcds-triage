/**
 * Diagnostic: Check what AgencyZoom SMS threads actually contain
 * and why outbound messages might be getting skipped.
 */

import { db } from "@/db";
import { messages } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

const AGENCYZOOM_AUTH_URL = "https://api.agencyzoom.com";
const AGENCYZOOM_SMS_URL = "https://app.agencyzoom.com";

let cachedToken: string | null = null;

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const email = process.env.AGENCYZOOM_API_USERNAME;
  const password = process.env.AGENCYZOOM_API_PASSWORD;
  const res = await fetch(`${AGENCYZOOM_AUTH_URL}/v1/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password, version: "1.0" }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  cachedToken = data.jwt;
  return cachedToken!;
}

async function main() {
  const tenantId = process.env.DEFAULT_TENANT_ID!;

  // 1. Check current DB message counts
  const [dbCounts] = await db.select({
    total: sql<number>`count(*)::int`,
    inbound: sql<number>`count(*) filter (where direction = 'inbound')::int`,
    outbound: sql<number>`count(*) filter (where direction = 'outbound')::int`,
    azSync: sql<number>`count(*) filter (where external_id like 'az_sms_%')::int`,
    twilioSend: sql<number>`count(*) filter (where external_id like 'SM%')::int`,
    localSend: sql<number>`count(*) filter (where external_id like 'local_%')::int`,
  }).from(messages).where(
    and(eq(messages.tenantId, tenantId), eq(messages.type, "sms"))
  );

  console.log("\n=== Current DB SMS Messages ===");
  console.log(`  Total:     ${dbCounts.total}`);
  console.log(`  Inbound:   ${dbCounts.inbound}`);
  console.log(`  Outbound:  ${dbCounts.outbound}`);
  console.log(`  AZ-synced: ${dbCounts.azSync}`);
  console.log(`  Twilio:    ${dbCounts.twilioSend}`);
  console.log(`  Local:     ${dbCounts.localSend}`);

  // 2. Fetch first few threads and dump their raw messages
  const token = await getToken();
  const res = await fetch(`${AGENCYZOOM_SMS_URL}/v1/api/text-thread/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 0, searchTerm: "", agentFilter: "", pageSize: 10, lastDateUTC: 0 }),
  });
  const data = await res.json();
  const threads = data.threadInfo || [];

  console.log(`\n=== First 10 AgencyZoom Threads ===`);
  console.log(`  Total threads available: ${data.totalRecords}`);

  for (const thread of threads.slice(0, 5)) {
    console.log(`\n--- Thread: ${thread.contactName || thread.phoneNumber} (${thread.id}) ---`);
    console.log(`  Phone: ${thread.phoneNumber}, ContactType: ${thread.contactType}`);
    console.log(`  LastMsg: ${thread.lastMessageDate}`);

    // Fetch messages for this thread
    const msgRes = await fetch(`${AGENCYZOOM_SMS_URL}/v1/api/text-thread/text-thread-detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ threadId: thread.id }),
    });
    const msgData = await msgRes.json();
    const msgs = msgData.messageInfo || [];

    console.log(`  Messages: ${msgs.length}`);
    let inCount = 0, outCount = 0;
    for (const m of msgs) {
      if (m.outbound) outCount++;
      else inCount++;
    }
    console.log(`    Incoming: ${inCount}, Outgoing: ${outCount}`);

    // Show first 3 messages raw
    for (const m of msgs.slice(0, 3)) {
      const dir = m.outbound ? "OUT" : "IN";
      const agent = m.agentFirstname ? `${m.agentFirstname} ${m.agentLastname}` : "no-agent";
      const externalId = `az_sms_${m.messageId || m.id}`;

      // Check if this exists in DB
      const existing = await db.query.messages.findFirst({
        where: (messages, { eq }) => eq(messages.externalId, externalId),
        columns: { id: true },
      });

      const body = (m.body || "").slice(0, 60);
      console.log(`    [${dir}] ${m.messageDateUTC || m.messageDate} | ${agent} | ${existing ? "IN DB" : "MISSING"} | "${body}..."`);
      console.log(`      id=${m.id}, messageId=${m.messageId}, status=${m.status}`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
