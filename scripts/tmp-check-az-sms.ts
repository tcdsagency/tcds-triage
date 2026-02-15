/**
 * Check AgencyZoom SMS data — API-only, no DB needed
 */
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.production.local") });

const AGENCYZOOM_AUTH_URL = "https://api.agencyzoom.com";
const AGENCYZOOM_SMS_URL = "https://app.agencyzoom.com";

let cachedToken: string | null = null;

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const email = process.env.AGENCYZOOM_API_USERNAME;
  const password = process.env.AGENCYZOOM_API_PASSWORD;
  if (!email || !password) throw new Error("AZ credentials not set");

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
  const token = await getToken();
  console.log("Authenticated with AgencyZoom\n");

  // Fetch first page of threads (most recent)
  const res = await fetch(`${AGENCYZOOM_SMS_URL}/v1/api/text-thread/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 0, searchTerm: "", agentFilter: "", pageSize: 20, lastDateUTC: 0 }),
  });
  const data = await res.json();
  const threads = data.threadInfo || [];

  console.log(`Total threads: ${data.totalRecords}`);
  console.log(`First page: ${threads.length} threads\n`);

  let totalOut = 0, totalIn = 0;

  for (const thread of threads.slice(0, 10)) {
    console.log(`--- ${thread.contactName || thread.phoneNumber} (${thread.phoneNumber}) ---`);
    console.log(`  Thread ID: ${thread.id}, Last: ${thread.lastMessageDateUTC || thread.lastMessageDate}`);

    const msgRes = await fetch(`${AGENCYZOOM_SMS_URL}/v1/api/text-thread/text-thread-detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ threadId: thread.id }),
    });
    const msgData = await msgRes.json();
    const msgs = msgData.messageInfo || [];

    let inCount = 0, outCount = 0;
    for (const m of msgs) {
      if (m.outbound) outCount++;
      else inCount++;
    }
    totalOut += outCount;
    totalIn += inCount;

    console.log(`  Messages: ${msgs.length} (${outCount} outgoing, ${inCount} incoming)`);

    // Show last 3 outbound messages
    const outMsgs = msgs.filter((m: any) => m.outbound).slice(-3);
    for (const m of outMsgs) {
      const body = (m.body || "").slice(0, 80);
      const agent = m.agentFirstname ? `${m.agentFirstname} ${m.agentLastname}` : "unknown";
      console.log(`    OUT: ${m.messageDateUTC || m.messageDate} | ${agent} | id=${m.messageId || m.id}`);
      console.log(`         "${body}"`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n=== Totals (first 10 threads) ===`);
  console.log(`  Outgoing: ${totalOut}`);
  console.log(`  Incoming: ${totalIn}`);
}

main().catch(err => { console.error(err); process.exit(1); });
