/**
 * Local SMS sync script — runs the full AgencyZoom SMS sync without Vercel timeout limits.
 * Usage: npx tsx scripts/tmp-run-sms-sync.ts [--months=6] [--incremental]
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.production.local") });
import { db } from "@/db";
import { messages } from "@/db/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// CONFIG
// =============================================================================

const args = process.argv.slice(2);
const isIncremental = args.includes("--incremental");
const monthsArg = args.find((a) => a.startsWith("--months="));
const months = monthsArg ? parseInt(monthsArg.split("=")[1], 10) : 6;
const tenantId = process.env.DEFAULT_TENANT_ID!;

// =============================================================================
// AGENCYZOOM API
// =============================================================================

const AGENCYZOOM_AUTH_URL = "https://api.agencyzoom.com";
const AGENCYZOOM_SMS_URL = "https://app.agencyzoom.com";

let cachedToken: string | null = null;

interface SMSThread {
  id: string;
  phoneNumber: string;
  contactId: number;
  contactType: string | null;
  contactName: string;
  lastMessageDate: string;
  lastMessageDateUTC: string;
  unread: boolean;
}

interface SMSMessage {
  id: string;
  body: string;
  direction: "incoming" | "outgoing";
  messageDate: string;
  status: string;
  agentName: string | null;
}

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const email = process.env.AGENCYZOOM_API_USERNAME;
  const password = process.env.AGENCYZOOM_API_PASSWORD;

  if (!email || !password) {
    throw new Error("AGENCYZOOM_API_USERNAME / AGENCYZOOM_API_PASSWORD not set");
  }

  const res = await fetch(`${AGENCYZOOM_AUTH_URL}/v1/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password, version: "1.0" }),
  });

  if (!res.ok) throw new Error(`AZ auth failed: ${res.status}`);
  const data = await res.json();
  cachedToken = data.jwt;
  return cachedToken!;
}

async function fetchThreads(
  pageSize = 200,
  lastDateUTC: string | number = 0
): Promise<{ threads: SMSThread[]; totalRecords: number }> {
  const token = await getToken();
  const res = await fetch(`${AGENCYZOOM_SMS_URL}/v1/api/text-thread/list`, {
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

  if (!res.ok) throw new Error(`Fetch threads failed: ${res.status}`);
  const data = await res.json();
  return { threads: data.threadInfo || [], totalRecords: data.totalRecords || 0 };
}

async function fetchThreadMessages(threadId: string): Promise<SMSMessage[]> {
  const token = await getToken();
  const res = await fetch(
    `${AGENCYZOOM_SMS_URL}/v1/api/text-thread/text-thread-detail`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ threadId }),
    }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return (data.messageInfo || []).map(
    (msg: {
      id: number;
      messageId: string;
      body: string;
      outbound: boolean;
      messageDate: string;
      messageDateUTC: string;
      status: string;
      agentFirstname: string | null;
      agentLastname: string | null;
    }) => ({
      id: msg.messageId || String(msg.id),
      body: msg.body || "",
      direction: msg.outbound ? ("outgoing" as const) : ("incoming" as const),
      messageDate: msg.messageDateUTC || msg.messageDate,
      status: msg.status || "delivered",
      agentName:
        msg.agentFirstname && msg.agentLastname
          ? `${msg.agentFirstname} ${msg.agentLastname}`
          : null,
    })
  );
}

// =============================================================================
// SYNC
// =============================================================================

function normalizePhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function isWithinMonths(dateStr: string, m: number): boolean {
  const date = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - m);
  return date >= cutoff;
}

async function main() {
  console.log(`\n=== SMS Sync (${isIncremental ? "incremental" : "full"}, last ${months} months) ===\n`);

  if (!tenantId) {
    console.error("DEFAULT_TENANT_ID not set");
    process.exit(1);
  }

  const agencyPhone = normalizePhone(process.env.AGENCY_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER || "");
  console.log(`Agency phone: ${agencyPhone}`);

  // 1. Fetch all threads
  console.log("\nFetching threads from AgencyZoom...");
  const allThreads: SMSThread[] = [];
  let hasMore = true;
  let lastDateUTC: string | number = 0;

  while (hasMore) {
    const result = await fetchThreads(200, lastDateUTC);
    allThreads.push(...result.threads);
    process.stdout.write(`\r  Fetched ${allThreads.length} threads...`);

    if (result.threads.length < 200) {
      hasMore = false;
    } else {
      const lastThread = result.threads[result.threads.length - 1];
      lastDateUTC = lastThread.lastMessageDateUTC;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`\n  Total threads: ${allThreads.length}`);

  // 2. Filter for processing
  const threadsToProcess = isIncremental
    ? allThreads.filter((t) => isWithinMonths(t.lastMessageDate, 1))
    : allThreads;
  console.log(`  Threads to process: ${threadsToProcess.length}\n`);

  // 3. Process each thread
  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (let i = 0; i < threadsToProcess.length; i++) {
    const thread = threadsToProcess[i];
    const contactPhone = normalizePhone(thread.phoneNumber);
    const label = thread.contactName || thread.phoneNumber;

    let contactType: "customer" | "lead" | undefined;
    if (thread.contactType === "customer") contactType = "customer";
    else if (thread.contactType === "lead") contactType = "lead";

    try {
      const threadMsgs = await fetchThreadMessages(thread.id);
      let imported = 0;
      let skipped = 0;

      for (const msg of threadMsgs) {
        // Skip incoming — those arrive via Twilio webhook
        if (msg.direction === "incoming") {
          skipped++;
          continue;
        }

        if (!isWithinMonths(msg.messageDate, months)) {
          skipped++;
          continue;
        }

        if (!msg.body?.trim()) {
          skipped++;
          continue;
        }

        const externalId = `az_sms_${msg.id}`;
        const existing = await db.query.messages.findFirst({
          where: (messages, { eq }) => eq(messages.externalId, externalId),
          columns: { id: true },
        });

        if (existing) {
          skipped++;
          continue;
        }

        try {
          await db.insert(messages).values({
            tenantId,
            type: "sms",
            direction: "outbound",
            fromNumber: agencyPhone,
            toNumber: contactPhone,
            body: msg.body,
            externalId,
            status: msg.status || "delivered",
            contactId: thread.contactId?.toString(),
            contactName: thread.contactName,
            contactType,
            isAcknowledged: true,
            sentAt: new Date(msg.messageDate),
          });
          imported++;
        } catch {
          totalErrors++;
        }
      }

      totalImported += imported;
      totalSkipped += skipped;

      const pct = ((i + 1) / threadsToProcess.length * 100).toFixed(0);
      if (imported > 0) {
        console.log(`  [${pct}%] ${label}: +${imported} imported, ${skipped} skipped`);
      } else {
        process.stdout.write(`\r  [${pct}%] Processing ${label}...              `);
      }
    } catch (err) {
      totalErrors++;
      console.log(`\n  ERROR on ${label}: ${err instanceof Error ? err.message : err}`);
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n\n=== Done ===`);
  console.log(`  Imported: ${totalImported}`);
  console.log(`  Skipped:  ${totalSkipped}`);
  console.log(`  Errors:   ${totalErrors}`);
  console.log();

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
