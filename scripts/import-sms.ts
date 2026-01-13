// Script to import SMS messages from AgencyZoom
// Run with: DATABASE_URL=... npx tsx scripts/import-sms.ts

import { db } from "../src/db";
import { messages } from "../src/db/schema";

const AGENCYZOOM_AUTH_URL = "https://api.agencyzoom.com";
const AGENCYZOOM_SMS_URL = "https://app.agencyzoom.com";

let cachedToken = "";

async function getToken() {
  if (cachedToken) return cachedToken;

  const response = await fetch(`${AGENCYZOOM_AUTH_URL}/v1/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.AGENCYZOOM_API_USERNAME,
      password: process.env.AGENCYZOOM_API_PASSWORD,
      version: "1.0",
    }),
  });

  const data = await response.json();
  cachedToken = data.jwt;
  return cachedToken;
}

async function fetchThreads(pageSize = 200, lastDateUTC: string | number = 0) {
  const token = await getToken();

  const response = await fetch(`${AGENCYZOOM_SMS_URL}/v1/api/text-thread/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      status: 0,
      searchTerm: "",
      agentFilter: "",
      pageSize,
      lastDateUTC,
    }),
  });

  const data = await response.json();
  return data.threadInfo || [];
}

async function fetchThreadMessages(threadId: string) {
  const token = await getToken();

  const response = await fetch(`${AGENCYZOOM_SMS_URL}/v1/api/text-thread/text-thread-detail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ threadId }),
  });

  const data = await response.json();
  return data.messageInfo || [];
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

async function run() {
  const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
  const agencyPhone = normalizePhone(process.env.TWILIO_PHONE_NUMBER || "+12059037886");

  console.log("Fetching threads...");
  const threads = await fetchThreads(200);
  console.log(`Found ${threads.length} threads`);

  let imported = 0;
  let skipped = 0;

  for (const thread of threads) {
    const msgs = await fetchThreadMessages(thread.id);
    console.log(`Thread ${thread.contactName || thread.phoneNumber}: ${msgs.length} messages`);

    for (const msg of msgs) {
      // Only import outgoing messages
      if (msg.outbound !== true) {
        skipped++;
        continue;
      }

      const externalId = `az_sms_${msg.messageId || msg.id}`;

      // Check for duplicate
      const existing = await db.query.messages.findFirst({
        where: (messages, { eq }) => eq(messages.externalId, externalId),
      });

      if (existing) {
        skipped++;
        continue;
      }

      await db.insert(messages).values({
        tenantId,
        type: "sms",
        direction: "outbound",
        fromNumber: agencyPhone,
        toNumber: normalizePhone(thread.phoneNumber),
        body: msg.body || "",
        externalId,
        status: msg.status || "delivered",
        contactId: thread.contactId ? String(thread.contactId) : undefined,
        contactName: thread.contactName,
        contactType: thread.contactType === "customer" ? "customer" : thread.contactType === "lead" ? "lead" : undefined,
        isAcknowledged: true,
        sentAt: new Date(msg.messageDateUTC || msg.messageDate),
      });
      imported++;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nDone! Imported: ${imported}, Skipped: ${skipped}`);
  process.exit(0);
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
