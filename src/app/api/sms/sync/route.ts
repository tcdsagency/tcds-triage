// API Route: /api/sms/sync
// SMS Thread Sync Service - Track and resync SMS history from AgencyZoom

export const maxDuration = 300; // 5 minutes — sync processes many threads

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { twilioClient } from "@/lib/twilio";

// =============================================================================
// TYPES
// =============================================================================

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

interface SyncJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  type: "full" | "incremental";
  startedAt: string;
  completedAt?: string;
  threadsTotal: number;
  threadsProcessed: number;
  messagesImported: number;
  messagesSkipped: number;
  errors: string[];
  currentThread?: string;
}

// In-memory sync history (last 10 jobs)
const syncHistory: SyncJob[] = [];
let currentJob: SyncJob | null = null;
let lastSuccessfulSyncAt: string | null = null;

// =============================================================================
// AGENCYZOOM API
// =============================================================================

const AGENCYZOOM_AUTH_URL = "https://api.agencyzoom.com";
const AGENCYZOOM_SMS_URL = "https://app.agencyzoom.com";

let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

async function getAgencyZoomToken(): Promise<string> {
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken;
  }

  const email = process.env.AGENCYZOOM_API_USERNAME;
  const password = process.env.AGENCYZOOM_API_PASSWORD;

  if (!email || !password) {
    throw new Error("AgencyZoom credentials not configured");
  }

  const response = await fetch(`${AGENCYZOOM_AUTH_URL}/v1/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: email,
      password: password,
      version: "1.0",
    }),
  });

  if (!response.ok) {
    throw new Error(`AgencyZoom auth failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = data.jwt;
  tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);

  return cachedToken!;
}

async function fetchSMSThreads(
  pageSize: number = 200,
  lastDateUTC: string | number = 0
): Promise<{ threads: SMSThread[]; totalRecords: number }> {
  const token = await getAgencyZoomToken();

  const response = await fetch(
    `${AGENCYZOOM_SMS_URL}/v1/api/text-thread/list`,
    {
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
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch SMS threads: ${response.status}`);
  }

  const data = await response.json();
  return {
    threads: data.threadInfo || [],
    totalRecords: data.totalRecords || 0,
  };
}

async function fetchThreadMessages(threadId: string): Promise<SMSMessage[]> {
  const token = await getAgencyZoomToken();

  const response = await fetch(
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

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  const messageInfo = data.messageInfo || [];

  return messageInfo.map((msg: {
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
    direction: msg.outbound ? "outgoing" : "incoming",
    messageDate: msg.messageDateUTC || msg.messageDate,
    status: msg.status || "delivered",
    agentName: msg.agentFirstname && msg.agentLastname
      ? `${msg.agentFirstname} ${msg.agentLastname}`
      : null,
  }));
}

// =============================================================================
// SYNC LOGIC
// =============================================================================

function normalizePhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

/** Parse AZ date strings as UTC (they omit the Z suffix) */
function parseUTC(dateStr: string): Date {
  const s = dateStr.trim();
  if (s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  return new Date(s + "Z");
}

function isWithinMonths(dateStr: string, months: number): boolean {
  const date = parseUTC(dateStr);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return date >= cutoff;
}

async function syncThread(
  tenantId: string,
  thread: SMSThread,
  agencyPhone: string,
  months: number
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const contactPhone = normalizePhone(thread.phoneNumber);

  let contactType: "customer" | "lead" | undefined;
  if (thread.contactType === "customer") {
    contactType = "customer";
  } else if (thread.contactType === "lead") {
    contactType = "lead";
  }

  try {
    const threadMessages = await fetchThreadMessages(thread.id);

    for (const msg of threadMessages) {
      if (!isWithinMonths(msg.messageDate, months)) {
        skipped++;
        continue;
      }

      if (!msg.body?.trim()) {
        skipped++;
        continue;
      }

      const isIncoming = msg.direction === "incoming";
      const direction = isIncoming ? "inbound" : "outbound";
      const fromPhone = isIncoming ? contactPhone : agencyPhone;
      const toPhone = isIncoming ? agencyPhone : contactPhone;
      const externalId = `az_sms_${msg.id}`;

      // Check if already imported via AZ sync (same externalId)
      const existing = await db.query.messages.findFirst({
        where: (messages, { eq }) => eq(messages.externalId, externalId),
      });

      if (existing) {
        skipped++;
        continue;
      }

      // For incoming messages, also check for Twilio webhook duplicates
      // Twilio messages use SM... externalIds so won't match above
      if (isIncoming) {
        const msgDate = parseUTC(msg.messageDate);
        const windowMs = 5 * 60 * 1000; // 5 minute window
        const dupCheck = await db.query.messages.findFirst({
          where: (messages, { eq, and, between }) =>
            and(
              eq(messages.direction, "inbound"),
              eq(messages.body, msg.body),
              between(
                messages.sentAt,
                new Date(msgDate.getTime() - windowMs),
                new Date(msgDate.getTime() + windowMs)
              )
            ),
        });

        if (dupCheck) {
          skipped++;
          continue;
        }
      }

      try {
        await db.insert(messages).values({
          tenantId,
          type: "sms",
          direction,
          fromNumber: fromPhone,
          toNumber: toPhone,
          body: msg.body,
          externalId,
          status: msg.status || "delivered",
          contactId: thread.contactId?.toString(),
          contactName: thread.contactName,
          contactType,
          isAcknowledged: true,
          sentAt: parseUTC(msg.messageDate),
        });
        imported++;
      } catch (error) {
        errors.push(`Message ${msg.id}: ${error instanceof Error ? error.message : "Insert failed"}`);
      }
    }
  } catch (error) {
    errors.push(`Thread ${thread.id}: ${error instanceof Error ? error.message : "Fetch failed"}`);
  }

  return { imported, skipped, errors };
}

async function runSync(tenantId: string, type: "full" | "incremental", months: number = 6) {
  const jobId = `sync_${Date.now()}`;

  currentJob = {
    id: jobId,
    status: "running",
    type,
    startedAt: new Date().toISOString(),
    threadsTotal: 0,
    threadsProcessed: 0,
    messagesImported: 0,
    messagesSkipped: 0,
    errors: [],
  };

  const agencyPhone = normalizePhone(process.env.TWILIO_PHONE_NUMBER || "");

  try {
    console.log(`[SMS Sync] Starting ${type} sync for last ${months} months`);

    // Fetch all threads
    const allThreads: SMSThread[] = [];
    let hasMore = true;
    let lastDateUTC: string | number = 0;

    while (hasMore) {
      const result = await fetchSMSThreads(200, lastDateUTC);
      allThreads.push(...result.threads);

      console.log(`[SMS Sync] Fetched ${result.threads.length} threads (total: ${allThreads.length})`);

      if (result.threads.length < 200) {
        hasMore = false;
      } else {
        const lastThread = result.threads[result.threads.length - 1];
        lastDateUTC = lastThread.lastMessageDateUTC;
      }

    }

    currentJob.threadsTotal = allThreads.length;

    // For incremental sync, process all threads changed since last successful sync
    // Falls back to 24 hours if no previous sync is recorded
    let threadsToProcess: SMSThread[];
    if (type === "incremental") {
      const sinceDate = lastSuccessfulSyncAt
        ? new Date(lastSuccessfulSyncAt)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);
      threadsToProcess = allThreads.filter((t) => {
        const threadDate = parseUTC(t.lastMessageDateUTC || t.lastMessageDate);
        return threadDate >= sinceDate;
      });
    } else {
      threadsToProcess = allThreads;
    }

    console.log(`[SMS Sync] Processing ${threadsToProcess.length} threads`);

    // Process each thread
    for (const thread of threadsToProcess) {
      currentJob.currentThread = thread.contactName || thread.phoneNumber;

      const result = await syncThread(tenantId, thread, agencyPhone, months);

      currentJob.messagesImported += result.imported;
      currentJob.messagesSkipped += result.skipped;
      currentJob.errors.push(...result.errors);
      currentJob.threadsProcessed++;
    }

    currentJob.status = "completed";
    currentJob.completedAt = new Date().toISOString();

    // Record successful sync time so next incremental picks up from here
    lastSuccessfulSyncAt = currentJob.startedAt;

    console.log(
      `[SMS Sync] Complete. Threads: ${currentJob.threadsProcessed}/${allThreads.length}, ` +
      `Imported: ${currentJob.messagesImported}, Skipped: ${currentJob.messagesSkipped}, ` +
      `Errors: ${currentJob.errors.length}`
    );
  } catch (error) {
    currentJob.status = "failed";
    currentJob.completedAt = new Date().toISOString();
    currentJob.errors.push(error instanceof Error ? error.message : "Unknown error");
    console.error("[SMS Sync] Failed:", error);
  }

  // Store in history (keep last 10)
  syncHistory.unshift({ ...currentJob });
  if (syncHistory.length > 10) {
    syncHistory.pop();
  }

  currentJob = null;
}

// =============================================================================
// API ROUTES
// =============================================================================

/**
 * POST /api/sms/sync - Run a sync job
 * Query params:
 *   - type: "full" | "incremental" (default: "full")
 *   - months: Number of months to sync (default: 6)
 */
export async function POST(request: NextRequest) {
  const tenantId = process.env.DEFAULT_TENANT_ID;

  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
  }

  if (currentJob) {
    return NextResponse.json(
      { error: "Sync already in progress", job: currentJob },
      { status: 409 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const type = (searchParams.get("type") as "full" | "incremental") || "full";
  const months = parseInt(searchParams.get("months") || "6", 10);

  // Await sync so Vercel keeps the function alive until completion
  await runSync(tenantId, type, months);

  return NextResponse.json({
    success: true,
    message: `${type} sync completed`,
    job: syncHistory[0] || null,
  });
}

/**
 * GET /api/sms/sync - Get sync status and history, or trigger sync if cron
 * Query params:
 *   - jobId: Get specific job status (optional)
 *   - trigger: Set to "true" to trigger an incremental sync (for cron use)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const jobId = searchParams.get("jobId");
  const trigger = searchParams.get("trigger");
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";

  // If triggered by cron or explicit trigger param, run an incremental sync
  if (isVercelCron || trigger === "true") {
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    if (currentJob) {
      return NextResponse.json({
        success: false,
        message: "Sync already in progress",
        job: currentJob,
      });
    }

    // Await sync so Vercel keeps the function alive until completion
    await runSync(tenantId, "incremental", 1);

    return NextResponse.json({
      success: true,
      message: "Incremental SMS sync completed via cron",
      job: syncHistory[0] || null,
    });
  }

  if (jobId) {
    // Find specific job
    if (currentJob?.id === jobId) {
      return NextResponse.json({ success: true, job: currentJob });
    }
    const historyJob = syncHistory.find((j) => j.id === jobId);
    if (historyJob) {
      return NextResponse.json({ success: true, job: historyJob });
    }
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Return current status and history
  return NextResponse.json({
    success: true,
    currentJob,
    history: syncHistory,
  });
}

/**
 * DELETE /api/sms/sync - Cancel current sync (if running)
 */
export async function DELETE() {
  if (!currentJob) {
    return NextResponse.json({ error: "No sync in progress" }, { status: 404 });
  }

  // Note: We can't actually stop the running Promise, but we mark it as cancelled
  currentJob.status = "failed";
  currentJob.completedAt = new Date().toISOString();
  currentJob.errors.push("Cancelled by user");

  syncHistory.unshift({ ...currentJob });
  if (syncHistory.length > 10) {
    syncHistory.pop();
  }

  const cancelledJob = currentJob;
  currentJob = null;

  return NextResponse.json({
    success: true,
    message: "Sync cancelled",
    job: cancelledJob,
  });
}
