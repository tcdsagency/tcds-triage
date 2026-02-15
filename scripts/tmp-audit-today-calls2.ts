import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { calls, serviceTickets, wrapupDrafts, users, liveTranscriptSegments } = await import('../src/db/schema');
  const { eq, gte, sql, like, or, desc } = await import('drizzle-orm');

  // Get all calls from today
  const todayStart = new Date('2026-02-12T00:00:00');
  
  console.log('=== ALL CALLS TODAY (Feb 12, 2026) ===\n');
  
  const todayCalls = await db.select().from(calls)
    .where(gte(calls.startedAt, todayStart))
    .orderBy(calls.startedAt);

  console.log(`Total calls today: ${todayCalls.length}\n`);

  for (const call of todayCalls) {
    const startTime = call.startedAt ? new Date(call.startedAt).toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const duration = call.durationSeconds || 0;
    const hasVmSession = !!call.vmSessionId;
    const hasTranscript = !!call.transcription;
    const segCount = call.transcriptionSegmentCount || 0;
    const hasRecording = !!call.recordingUrl;
    const hasSummary = !!call.aiSummary;
    const txStatus = call.transcriptionStatus || 'none';
    
    // Get agent name
    let agentName = 'unknown';
    if (call.agentId) {
      const [user] = await db.select({ firstName: users.firstName, lastName: users.lastName })
        .from(users).where(eq(users.id, call.agentId)).limit(1);
      if (user) agentName = `${user.firstName} ${user.lastName}`;
    }

    // Check for wrapup draft
    let hasWrapup = false;
    let wrapupStatus = 'none';
    try {
      const [wu] = await db.select({ id: wrapupDrafts.id, status: wrapupDrafts.status }).from(wrapupDrafts)
        .where(eq(wrapupDrafts.callId, call.id)).limit(1);
      if (wu) {
        hasWrapup = true;
        wrapupStatus = wu.status;
      }
    } catch (e) {}

    // Check for live segments
    let liveSegCount = 0;
    try {
      const segs = await db.select({ count: sql<number>`count(*)` }).from(liveTranscriptSegments)
        .where(eq(liveTranscriptSegments.callId, call.id));
      liveSegCount = segs[0]?.count || 0;
    } catch (e) {}

    const caller = call.fromNumber || 'N/A';
    const called = call.toNumber || 'N/A';
    const dir = call.directionFinal || call.direction || '?';
    
    const issues: string[] = [];
    if (!hasVmSession) issues.push('NO VM SESSION');
    if (!hasTranscript && duration > 15) issues.push('NO TRANSCRIPT');
    if (!hasRecording && duration > 15) issues.push('NO RECORDING');
    if (txStatus === 'completed' && !hasTranscript) issues.push('STATUS=COMPLETED BUT EMPTY');
    if (!hasWrapup && duration > 15 && (dir === 'inbound')) issues.push('NO WRAPUP');
    
    console.log(`${startTime} | ${dir.padEnd(8)} | ${duration.toString().padStart(4)}s | ${caller.padEnd(14)} -> ${called.padEnd(14)} | agent: ${agentName.padEnd(18)} | vm: ${hasVmSession ? 'YES' : 'NO '} | tx: ${txStatus.padEnd(10)} | segs: ${String(segCount).padStart(3)} | live: ${String(liveSegCount).padStart(3)} | rec: ${hasRecording ? 'YES' : 'NO '} | wrapup: ${hasWrapup ? wrapupStatus.padEnd(12) : 'NONE'.padEnd(12)} | summary: ${hasSummary ? 'YES' : 'NO '}`);
    if (issues.length > 0) {
      console.log(`  >> ISSUES: ${issues.join(', ')}`);
    }
    
    // Flag the specific call user mentioned
    if (caller.includes('2565022774') || called.includes('2565022774')) {
      console.log(`  ** THIS IS THE 2565022774 CALL **`);
      console.log(`     Call ID: ${call.id}`);
      console.log(`     Status: ${call.status}`);
      console.log(`     External Call ID: ${call.externalCallId}`);
      console.log(`     VM Session ID: ${call.vmSessionId}`);
      console.log(`     Extension: ${call.extension}`);
      console.log(`     Started: ${call.startedAt}`);
      console.log(`     Ended: ${call.endedAt}`);
      console.log(`     Answered: ${call.answeredAt}`);
      console.log(`     Transcription Status: ${call.transcriptionStatus}`);
      console.log(`     Transcription Error: ${call.transcriptionError}`);
      console.log(`     Has Transcript: ${!!call.transcription} (${call.transcription?.length || 0} chars)`);
      console.log(`     AI Summary: ${call.aiSummary?.substring(0, 200) || 'none'}`);
    }
  }

  // Also search for 2565022774 specifically across all time
  console.log('\n\n=== SEARCH FOR 2565022774 (all time, last 10) ===');
  const phoneSearch = await db.select().from(calls)
    .where(or(
      like(calls.fromNumber, '%2565022774%'),
      like(calls.toNumber, '%2565022774%'),
    ))
    .orderBy(desc(calls.startedAt))
    .limit(10);
  
  console.log(`Found ${phoneSearch.length} calls for 2565022774:`);
  for (const c of phoneSearch) {
    const time = c.startedAt ? new Date(c.startedAt).toLocaleString() : 'N/A';
    const dir = c.directionFinal || c.direction;
    console.log(`  ${time} | ${dir} | ${c.durationSeconds}s | ${c.status} | id: ${c.id.substring(0,8)} | vm: ${c.vmSessionId ? 'YES' : 'NO'} | tx: ${c.transcriptionStatus || 'none'}`);
  }

  // Check service tickets created today
  console.log('\n\n=== SERVICE TICKETS CREATED TODAY ===');
  try {
    const todayTickets = await db.select().from(serviceTickets)
      .where(gte(serviceTickets.createdAt, todayStart))
      .orderBy(serviceTickets.createdAt);
    
    console.log(`Tickets created today: ${todayTickets.length}`);
    for (const t of todayTickets) {
      const subj = (t as any).subject || (t as any).title || (t as any).description || 'N/A';
      console.log(`  ${t.createdAt} | ${t.status} | ${typeof subj === 'string' ? subj.substring(0, 80) : 'N/A'}`);
    }
  } catch (e: any) {
    console.log(`Error checking tickets: ${e.message}`);
  }

  // Wrapup drafts created today  
  console.log('\n\n=== WRAPUP DRAFTS CREATED TODAY ===');
  try {
    const todayWrapups = await db.select({
      id: wrapupDrafts.id,
      callId: wrapupDrafts.callId,
      status: wrapupDrafts.status,
      customerName: wrapupDrafts.customerName,
      summary: wrapupDrafts.summary,
      direction: wrapupDrafts.direction,
      completionAction: wrapupDrafts.completionAction,
      isAutoVoided: wrapupDrafts.isAutoVoided,
      createdAt: wrapupDrafts.createdAt,
    }).from(wrapupDrafts)
      .where(gte(wrapupDrafts.createdAt, todayStart))
      .orderBy(wrapupDrafts.createdAt);
    
    console.log(`Wrapup drafts today: ${todayWrapups.length}`);
    for (const w of todayWrapups) {
      const summarySnip = w.summary ? w.summary.substring(0, 60) : 'no summary';
      console.log(`  ${w.createdAt} | ${w.status.padEnd(20)} | ${w.direction.padEnd(8)} | ${(w.customerName || '?').padEnd(20)} | void: ${w.isAutoVoided ? 'YES' : 'NO '} | action: ${(w.completionAction || 'none').padEnd(10)} | ${summarySnip}`);
    }
  } catch (e: any) {
    console.log(`Error checking wrapups: ${e.message}`);
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
