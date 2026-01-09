// API Route: /api/sms/import
// Import historical SMS messages from AgencyZoom
// Uses app.agencyzoom.com/v1/api/text-thread/* endpoints

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema";

// =============================================================================
// TYPES (based on AgencyZoom SMS API)
// =============================================================================

interface SMSThread {
  id: string;
  phoneNumber: string;
  contactId: string;
  contactType: "customer" | "lead" | "contact";
  contactName: string;
  agentId: string;
  agentName: string;
  lastMessageDate: string;
  lastMessageDateUTC: string;
  unreadCount: number;
}

interface SMSMessage {
  id: string;
  body: string;
  direction: "incoming" | "outgoing";
  messageDate: string;
  status: string;
  agentName: string | null;
}

interface ImportProgress {
  status: "idle" | "running" | "completed" | "failed";
  threadsTotal: number;
  threadsProcessed: number;
  messagesImported: number;
  messagesSkipped: number;
  currentThread: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// In-memory progress tracking (would use Redis in production)
let importProgress: ImportProgress = {
  status: "idle",
  threadsTotal: 0,
  threadsProcessed: 0,
  messagesImported: 0,
  messagesSkipped: 0,
  currentThread: "",
};

// =============================================================================
// AGENCYZOOM SMS API HELPERS
// =============================================================================

// Auth uses api.agencyzoom.com, but SMS endpoints use app.agencyzoom.com
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
  tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23 hours

  return cachedToken!;
}

/**
 * Fetch SMS threads using POST /v1/api/text-thread/list
 * Uses app.agencyzoom.com (not api.agencyzoom.com)
 */
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
        status: 0, // 0 = all threads including historical
        searchTerm: "",
        agentFilter: "",
        pageSize,
        lastDateUTC,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[SMS Import] Thread list error: ${response.status}`, errorText);
    throw new Error(`Failed to fetch SMS threads: ${response.status}`);
  }

  const data = await response.json();
  return {
    threads: data.threadInfo || [],
    totalRecords: data.totalRecords || 0,
  };
}

/**
 * Fetch messages for a specific thread using text-thread-detail
 * Uses app.agencyzoom.com (not api.agencyzoom.com)
 */
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
    console.warn(`[SMS Import] Failed to fetch messages for thread ${threadId}: ${response.status}`);
    return [];
  }

  const data = await response.json();

  // Transform messageInfo to SMSMessage format
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
// IMPORT LOGIC
// =============================================================================

function normalizePhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function isWithinMonths(dateStr: string, months: number): boolean {
  const date = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return date >= cutoff;
}

/**
 * Import messages for a single thread
 */
async function importThreadMessages(
  tenantId: string,
  thread: SMSThread,
  threadMessages: SMSMessage[],
  agencyPhone: string,
  months: number
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  const contactPhone = normalizePhone(thread.phoneNumber);

  // Determine contact type
  let contactType: "customer" | "lead" | undefined;
  if (thread.contactType === "customer") {
    contactType = "customer";
  } else if (thread.contactType === "lead") {
    contactType = "lead";
  }

  for (const msg of threadMessages) {
    // IMPORTANT: Skip incoming messages - they arrive via Twilio webhook
    // This prevents duplicates since Twilio webhook uses a different externalId (Twilio SID)
    // AgencyZoom uses its own message ID, so the same message would be stored twice
    if (msg.direction === "incoming") {
      skipped++;
      continue;
    }

    // Filter by date
    if (!isWithinMonths(msg.messageDate, months)) {
      skipped++;
      continue;
    }

    // Skip empty messages
    if (!msg.body?.trim()) {
      skipped++;
      continue;
    }

    // Only outgoing messages from AgencyZoom reach here
    const direction = "outbound";
    const fromPhone = agencyPhone;
    const toPhone = contactPhone;

    // Use message ID for deduplication
    const externalId = `az_sms_${msg.id}`;

    // Check for duplicate
    const existing = await db.query.messages.findFirst({
      where: (messages, { eq }) => eq(messages.externalId, externalId),
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Insert message
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
        contactId: thread.contactId,
        contactName: thread.contactName,
        contactType,
        isAcknowledged: true, // Historical messages are auto-acknowledged
        sentAt: new Date(msg.messageDate),
      });
      imported++;
    } catch (error) {
      console.error(`[SMS Import] Error inserting message ${msg.id}:`, error);
    }
  }

  return { imported, skipped };
}

/**
 * Run the import process
 * 1. Fetch all threads with pagination
 * 2. For each thread, fetch messages
 * 3. Filter to last N months, dedupe, insert
 */
async function runImport(tenantId: string, months: number = 6) {
  importProgress = {
    status: "running",
    threadsTotal: 0,
    threadsProcessed: 0,
    messagesImported: 0,
    messagesSkipped: 0,
    currentThread: "",
    startedAt: new Date().toISOString(),
  };

  const agencyPhone = normalizePhone(process.env.TWILIO_PHONE_NUMBER || "");

  try {
    console.log(`[SMS Import] Starting import for last ${months} months`);

    // Step 1: Fetch all threads with pagination
    console.log("[SMS Import] Fetching threads...");
    const allThreads: SMSThread[] = [];
    let hasMore = true;
    let lastDateUTC: string | number = 0;

    while (hasMore) {
      const result = await fetchSMSThreads(200, lastDateUTC);
      allThreads.push(...result.threads);

      console.log(`[SMS Import] Fetched ${result.threads.length} threads (total: ${allThreads.length})`);

      if (result.threads.length < 200) {
        hasMore = false;
      } else {
        // Use last thread's date for pagination cursor
        const lastThread = result.threads[result.threads.length - 1];
        lastDateUTC = lastThread.lastMessageDateUTC || `0_${lastThread.lastMessageDate}`;
      }

      // Rate limiting between pages
      await new Promise((r) => setTimeout(r, 300));
    }

    importProgress.threadsTotal = allThreads.length;
    console.log(`[SMS Import] Found ${allThreads.length} total threads`);

    // Step 2: Process each thread
    for (const thread of allThreads) {
      importProgress.currentThread = thread.contactName || thread.phoneNumber;

      try {
        // Fetch messages for this thread
        const threadMessages = await fetchThreadMessages(thread.id);

        // Import messages
        const { imported, skipped } = await importThreadMessages(
          tenantId,
          thread,
          threadMessages,
          agencyPhone,
          months
        );

        importProgress.messagesImported += imported;
        importProgress.messagesSkipped += skipped;
      } catch (error) {
        console.error(`[SMS Import] Error processing thread ${thread.id}:`, error);
      }

      importProgress.threadsProcessed++;

      // Rate limiting between threads
      await new Promise((r) => setTimeout(r, 100));
    }

    importProgress.status = "completed";
    importProgress.completedAt = new Date().toISOString();
    console.log(
      `[SMS Import] Complete. Threads: ${importProgress.threadsProcessed}, ` +
      `Imported: ${importProgress.messagesImported}, Skipped: ${importProgress.messagesSkipped}`
    );
  } catch (error) {
    importProgress.status = "failed";
    importProgress.error = error instanceof Error ? error.message : "Unknown error";
    console.error("[SMS Import] Failed:", error);
  }
}

// =============================================================================
// API ROUTES
// =============================================================================

/**
 * POST /api/sms/import - Start historical import
 * Query params:
 *   - months: Number of months to import (default: 6)
 */
export async function POST(request: NextRequest) {
  const tenantId = process.env.DEFAULT_TENANT_ID;

  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
  }

  // Check if already running
  if (importProgress.status === "running") {
    return NextResponse.json(
      { error: "Import already in progress", progress: importProgress },
      { status: 409 }
    );
  }

  // Get months parameter (default 6)
  const searchParams = request.nextUrl.searchParams;
  const months = parseInt(searchParams.get("months") || "6", 10);

  // Start import in background
  runImport(tenantId, months).catch(console.error);

  return NextResponse.json({
    success: true,
    message: `Import started for last ${months} months`,
    progress: importProgress,
  });
}

/**
 * GET /api/sms/import - Get import progress
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    progress: importProgress,
  });
}
