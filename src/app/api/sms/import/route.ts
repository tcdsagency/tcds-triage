// API Route: /api/sms/import
// Import historical SMS messages from AgencyZoom

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { twilioClient } from "@/lib/twilio";

// =============================================================================
// TYPES
// =============================================================================

interface SMSThread {
  id: string;
  phoneNumber: string;
  contactId: string;
  contactName: string;
  contactType: "customer" | "lead";
  agentId: string;
  lastMessageDate: string;
}

interface SMSMessage {
  id: string;
  body: string;
  direction: "incoming" | "outgoing";
  messageDate: string;
  status: string;
  agentName: string;
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

const AGENCYZOOM_API_URL = "https://api.agencyzoom.com";
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

  const response = await fetch(`${AGENCYZOOM_API_URL}/v1/api/auth/login`, {
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

async function fetchSMSThreads(lastDateUTC: number = 0): Promise<{
  threads: SMSThread[];
  hasMore: boolean;
}> {
  const token = await getAgencyZoomToken();

  const response = await fetch(`${AGENCYZOOM_API_URL}/v1/api/sms/threads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      pageSize: 200,
      lastDateUTC: lastDateUTC > 0 ? `0_${lastDateUTC}` : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch SMS threads: ${response.status}`);
  }

  const data = await response.json();
  const threads = data.threads || [];

  return {
    threads,
    hasMore: threads.length >= 200,
  };
}

async function fetchThreadMessages(threadId: string): Promise<SMSMessage[]> {
  const token = await getAgencyZoomToken();

  const response = await fetch(
    `${AGENCYZOOM_API_URL}/v1/api/sms/threads/${threadId}/messages`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    console.warn(`Failed to fetch messages for thread ${threadId}: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return data.messages || [];
}

// =============================================================================
// IMPORT LOGIC
// =============================================================================

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function isWithinSixMonths(dateStr: string): boolean {
  const date = new Date(dateStr);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return date >= sixMonthsAgo;
}

async function importThreadMessages(
  tenantId: string,
  thread: SMSThread,
  smsMessages: SMSMessage[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  const agencyPhone = normalizePhone(process.env.TWILIO_PHONE_NUMBER || "");

  // Filter to last 6 months
  const recentMessages = smsMessages.filter((m) => isWithinSixMonths(m.messageDate));

  for (const msg of recentMessages) {
    // Skip empty messages
    if (!msg.body?.trim()) {
      skipped++;
      continue;
    }

    const contactPhone = normalizePhone(thread.phoneNumber);
    const direction = msg.direction === "outgoing" ? "outbound" : "inbound";
    const fromPhone = direction === "outbound" ? agencyPhone : contactPhone;
    const toPhone = direction === "outbound" ? contactPhone : agencyPhone;

    // Check for duplicate by external ID
    const existing = await db.query.messages.findFirst({
      where: (messages, { eq }) => eq(messages.externalId, `az_${msg.id}`),
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Insert message
    await db.insert(messages).values({
      tenantId,
      type: "sms",
      direction,
      fromNumber: fromPhone,
      toNumber: toPhone,
      body: msg.body,
      externalId: `az_${msg.id}`, // Prefix to distinguish from Twilio IDs
      status: msg.status || "delivered",
      contactId: thread.contactId,
      contactName: thread.contactName,
      contactType: thread.contactType,
      isAcknowledged: true, // Historical messages are auto-acknowledged
      sentAt: new Date(msg.messageDate),
    });

    imported++;
  }

  return { imported, skipped };
}

async function runImport(tenantId: string) {
  importProgress = {
    status: "running",
    threadsTotal: 0,
    threadsProcessed: 0,
    messagesImported: 0,
    messagesSkipped: 0,
    currentThread: "",
    startedAt: new Date().toISOString(),
  };

  try {
    // Step 1: Fetch all threads
    console.log("[SMS Import] Fetching threads...");
    const allThreads: SMSThread[] = [];
    let hasMore = true;
    let lastDateUTC = 0;

    while (hasMore) {
      const result = await fetchSMSThreads(lastDateUTC);
      allThreads.push(...result.threads);
      hasMore = result.hasMore;

      if (result.threads.length > 0) {
        const lastThread = result.threads[result.threads.length - 1];
        lastDateUTC = new Date(lastThread.lastMessageDate).getTime();
      }

      // Rate limiting
      await new Promise((r) => setTimeout(r, 300));
    }

    importProgress.threadsTotal = allThreads.length;
    console.log(`[SMS Import] Found ${allThreads.length} threads`);

    // Step 2: Process each thread
    for (const thread of allThreads) {
      importProgress.currentThread = thread.contactName || thread.phoneNumber;

      try {
        // Fetch messages for thread
        const threadMessages = await fetchThreadMessages(thread.id);

        // Import messages
        const { imported, skipped } = await importThreadMessages(
          tenantId,
          thread,
          threadMessages
        );

        importProgress.messagesImported += imported;
        importProgress.messagesSkipped += skipped;
      } catch (error) {
        console.error(`[SMS Import] Error processing thread ${thread.id}:`, error);
      }

      importProgress.threadsProcessed++;

      // Rate limiting
      await new Promise((r) => setTimeout(r, 100));
    }

    importProgress.status = "completed";
    importProgress.completedAt = new Date().toISOString();
    console.log(
      `[SMS Import] Complete. Imported: ${importProgress.messagesImported}, Skipped: ${importProgress.messagesSkipped}`
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

  // Start import in background
  runImport(tenantId).catch(console.error);

  return NextResponse.json({
    success: true,
    message: "Import started",
    progress: importProgress,
  });
}

/**
 * GET /api/sms/import - Get import progress
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    progress: importProgress,
  });
}
