/**
 * Import Historical Transcripts from CSV/Excel
 *
 * Usage:
 *   npx tsx scripts/import-historical-transcripts.ts path/to/transcripts.csv
 *
 * Expected CSV columns (flexible - will map common variations):
 *   - date/call_date/Date           : Call date (required)
 *   - phone/customer_phone/Phone    : Customer phone number (required)
 *   - transcript/Transcript/notes   : The transcript text (required)
 *   - name/customer_name/Name       : Customer name (optional)
 *   - agent/agent_name/Agent        : Agent who handled call (optional)
 *   - direction/Direction           : inbound/outbound (optional)
 *   - duration/duration_seconds     : Call duration in seconds (optional)
 */

import { db } from "../src/db";
import { historicalTranscripts, customers } from "../src/db/schema";
import { eq, ilike, sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

// =============================================================================
// CONFIG
// =============================================================================

const TENANT_ID = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
const BATCH_SIZE = 50;
const RUN_AI_EXTRACTION = process.env.RUN_AI_EXTRACTION === "true"; // Set to true to extract AI insights

// =============================================================================
// CSV PARSER (simple, handles quoted fields)
// =============================================================================

function parseCSV(content: string): Array<Record<string, string>> {
  const lines = content.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, idx) => {
      row[header.trim().toLowerCase()] = values[idx]?.trim() || "";
    });

    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

// =============================================================================
// COLUMN MAPPING (flexible column names)
// =============================================================================

function mapColumns(row: Record<string, string>): {
  date: string | null;
  phone: string | null;
  transcript: string | null;
  name: string | null;
  agent: string | null;
  direction: string | null;
  duration: number | null;
  email: string | null;
  azId: string | null;
  tone: string | null;
  followUp: string | null;
} {
  // Find date column - including your format "date/time"
  const dateCol = row["date/time"] || row["date"] || row["call_date"] || row["calldate"] || row["call date"] || null;

  // Find phone column - your format uses "number"
  const phoneCol = row["number"] || row["phone"] || row["customer_phone"] || row["customerphone"] ||
                   row["phone_number"] || row["phonenumber"] || row["telephone"] || null;

  // Find transcript/summary column - your format uses "call summary"
  const transcriptCol = row["call summary"] || row["transcript"] || row["transcription"] || row["notes"] ||
                        row["call_notes"] || row["callnotes"] || row["text"] || null;

  // Find name column
  const nameCol = row["name"] || row["customer_name"] || row["customername"] ||
                  row["customer"] || row["client"] || row["client_name"] || null;

  // Find agent column - your format uses "call from/to"
  const agentCol = row["call from/to"] || row["agent"] || row["agent_name"] || row["agentname"] ||
                   row["rep"] || row["representative"] || row["handled_by"] || null;

  // Find direction column
  const directionCol = row["direction"] || row["call_direction"] || row["type"] || null;

  // Find duration column
  const durationCol = row["duration"] || row["duration_seconds"] || row["durationseconds"] ||
                      row["call_duration"] || row["length"] || null;

  // Your specific columns
  const emailCol = row["email"] || null;
  const azIdCol = row["az match?"] || row["az_match"] || row["agencyzoom_id"] || null;
  const toneCol = row["call tone"] || row["tone"] || row["sentiment"] || null;
  const followUpCol = row["follow up item?"] || row["follow_up"] || row["followup"] || null;

  return {
    date: dateCol,
    phone: phoneCol,
    transcript: transcriptCol,
    name: nameCol,
    agent: agentCol,
    direction: directionCol?.toLowerCase().includes("out") ? "outbound" :
               directionCol?.toLowerCase().includes("in") ? "inbound" : null,
    duration: durationCol ? parseInt(durationCol) || null : null,
    email: emailCol,
    azId: azIdCol,
    tone: toneCol,
    followUp: followUpCol,
  };
}

// =============================================================================
// PHONE NORMALIZATION
// =============================================================================

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

// =============================================================================
// CUSTOMER LOOKUP CACHE
// =============================================================================

const customerCache = new Map<string, string | null>();

async function findCustomerByPhone(phone: string): Promise<string | null> {
  const normalizedPhone = normalizePhone(phone);

  if (customerCache.has(normalizedPhone)) {
    return customerCache.get(normalizedPhone) || null;
  }

  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(ilike(customers.phone, `%${normalizedPhone}`))
    .limit(1);

  const customerId = customer?.id || null;
  customerCache.set(normalizedPhone, customerId);
  return customerId;
}

// =============================================================================
// PARSE DATE
// =============================================================================

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try various formats
  const formats = [
    // ISO
    /^(\d{4})-(\d{2})-(\d{2})/, // 2023-01-15
    // US formats
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})/, // 1/15/2023 or 01/15/2023
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, // 1/15/23
    // With time
    /^(\d{4})-(\d{2})-(\d{2})\s+\d/, // 2023-01-15 10:30
  ];

  // Try native parsing first
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Try MM/DD/YYYY format
  const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (usMatch) {
    let year = parseInt(usMatch[3]);
    if (year < 100) year += 2000;
    return new Date(year, parseInt(usMatch[1]) - 1, parseInt(usMatch[2]));
  }

  return null;
}

// =============================================================================
// MAIN IMPORT FUNCTION
// =============================================================================

async function importTranscripts(filePath: string) {
  console.log(`\n📂 Reading file: ${filePath}\n`);

  // Check file exists
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  // Read and parse file
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);

  console.log(`📊 Found ${rows.length} rows in CSV\n`);

  if (rows.length === 0) {
    console.error("❌ No data rows found in file");
    process.exit(1);
  }

  // Show first row to help debug column mapping
  console.log("📋 Sample row columns:", Object.keys(rows[0]).join(", "));
  const sampleMapped = mapColumns(rows[0]);
  console.log("📋 Mapped sample:", JSON.stringify(sampleMapped, null, 2));
  console.log("");

  // Stats
  let imported = 0;
  let skipped = 0;
  let matched = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const insertValues: Array<typeof historicalTranscripts.$inferInsert> = [];

    for (const row of batch) {
      const mapped = mapColumns(row);

      // Validate required fields
      if (!mapped.date || !mapped.phone || !mapped.transcript) {
        skipped++;
        continue;
      }

      const callDate = parseDate(mapped.date);
      if (!callDate) {
        console.warn(`⚠️  Invalid date: "${mapped.date}"`);
        skipped++;
        continue;
      }

      // Try to match customer by phone or AgencyZoom ID
      let customerId = await findCustomerByPhone(mapped.phone);
      if (customerId) matched++;

      // The "Call Summary" in your spreadsheet is already an AI summary, not raw transcript
      // Store it in aiSummary field, and in transcript as well for search
      insertValues.push({
        tenantId: TENANT_ID,
        customerId,
        customerPhone: normalizePhone(mapped.phone),
        customerName: mapped.name || undefined,
        callDate,
        direction: mapped.direction || undefined,
        agentName: mapped.agent || undefined,
        durationSeconds: mapped.duration || undefined,
        transcript: mapped.transcript, // Store summary as transcript for search
        aiSummary: mapped.transcript,  // Also store as AI summary since it's pre-summarized
        aiTopics: mapped.tone ? [mapped.tone] : undefined, // Store call tone as topic
        importSource: "spreadsheet",
        externalId: mapped.azId || undefined, // Store AZ Match ID if present
      });
    }

    // Bulk insert batch
    if (insertValues.length > 0) {
      try {
        await db.insert(historicalTranscripts).values(insertValues);
        imported += insertValues.length;
      } catch (err: any) {
        console.error(`❌ Batch insert error:`, err.message);
        errors += insertValues.length;
      }
    }

    // Progress
    const progress = Math.min(i + BATCH_SIZE, rows.length);
    process.stdout.write(`\r⏳ Progress: ${progress}/${rows.length} rows processed...`);
  }

  console.log("\n");
  console.log("═".repeat(50));
  console.log("📊 IMPORT COMPLETE");
  console.log("═".repeat(50));
  console.log(`✅ Imported:        ${imported}`);
  console.log(`👤 Customer matched: ${matched}`);
  console.log(`⏭️  Skipped:         ${skipped}`);
  console.log(`❌ Errors:          ${errors}`);
  console.log("═".repeat(50));

  if (RUN_AI_EXTRACTION) {
    console.log("\n🤖 Running AI extraction on imported transcripts...");
    // TODO: Call AI extraction API for new transcripts
  }
}

// =============================================================================
// CLI ENTRY POINT
// =============================================================================

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
📚 Historical Transcript Import Tool
=====================================

Usage:
  DATABASE_URL="your-db-url" npx tsx scripts/import-historical-transcripts.ts <csv-file>

Your spreadsheet columns are supported:
  - Date/Time           : Call date (required)
  - Number              : Customer phone (required)
  - Call Summary        : Transcript/summary text (required)
  - Name                : Customer name (optional)
  - Call From/To        : Agent name (optional)
  - Email               : Customer email (optional)
  - AZ Match?           : AgencyZoom ID (optional)
  - Call tone           : Sentiment/tone (optional)
  - Follow Up Item?     : Follow-up notes (optional)

Also supports generic column names:
  - date, call_date, phone, customer_phone, transcript, etc.

Example:
  DATABASE_URL="postgresql://..." npx tsx scripts/import-historical-transcripts.ts ~/Downloads/call-transcripts.csv

Note: Export your Google Sheet/Excel as CSV first.
`);
  process.exit(0);
}

const filePath = path.resolve(args[0]);
importTranscripts(filePath).then(() => process.exit(0)).catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
