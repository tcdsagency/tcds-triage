import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });

const sql = postgres(process.env.DATABASE_URL!, { connect_timeout: 10 });

async function main() {
  const callIds = [
    '5843fbe6-dbe7-44d3-a96d-deb836659f64',
    '98a81296-f903-4c9a-8726-e2b25372d490',
    '3bb60e78-eb31-4f6a-bf8d-65e4563b0828',
    '81587cc8-2dd2-45a1-9d4f-d31ab5c8f8e2',
    '22ce1730-bf20-46f2-bff2-5d183a2977c6',
    '0cb81291-5e74-4528-9c46-db7f649e9106',
    '544ea342-ff5c-4182-9b11-5395e17f49ef',
    '29da577e-90fc-4a52-a6c4-2941e928190e',
  ];

  // 1. Get the external_call_ids for these calls
  const theseCalls = await sql`
    SELECT id, external_call_id, from_number, to_number, started_at, disposition
    FROM calls WHERE id = ANY(${callIds}::uuid[])
  `;

  const externalIds = theseCalls.map(c => c.external_call_id).filter(Boolean);
  console.log('=== External Call IDs ===');
  for (const c of theseCalls) {
    console.log(`  ${c.id} → ${c.external_call_id} | ${c.disposition}`);
  }

  // 2. Check for duplicate call records with same external_call_id
  console.log('\n=== DUPLICATE CHECK: Other calls with same external_call_id ===');
  const dupes = await sql`
    SELECT c.id, c.external_call_id, c.status, c.disposition, c.started_at, c.duration_seconds,
      w.id as wrapup_id, w.status as wrapup_status
    FROM calls c
    LEFT JOIN wrapup_drafts w ON w.call_id = c.id
    WHERE c.external_call_id = ANY(${externalIds})
    ORDER BY c.external_call_id, c.started_at
  `;
  console.log(`Found ${dupes.length} total call records for ${externalIds.length} external IDs`);
  for (const d of dupes) {
    const isMissing = callIds.includes(d.id);
    console.log(`  ${d.external_call_id} | call:${d.id.slice(0,8)} | disp:${(d.disposition||'null').padEnd(12)} | dur:${(d.duration_seconds?.toString()||'n/a').padStart(5)} | wrapup:${d.wrapup_id ? d.wrapup_status : 'NONE'}${isMissing ? ' ← MISSING WRAPUP' : ''}`);
  }

  // 3. Check for wrapups with these phones around same time (linked to different call?)
  console.log('\n=== WRAPUPS FOR SAME PHONES ===');
  for (const c of theseCalls.slice(0, 4)) {
    const phone = c.to_number;
    if (!phone) continue;
    const digits = phone.replace(/\D/g, '').slice(-10);
    const wrapups = await sql`
      SELECT w.id, w.call_id, w.customer_phone, w.status, w.completion_action, w.created_at, w.summary
      FROM wrapup_drafts w
      WHERE w.customer_phone LIKE ${'%' + digits}
        AND w.created_at > ${new Date(new Date(c.started_at).getTime() - 60 * 60000)}
        AND w.created_at < ${new Date(new Date(c.started_at).getTime() + 60 * 60000)}
    `;
    if (wrapups.length > 0) {
      console.log(`  Phone ${phone} (call ${c.id.slice(0,8)}):`);
      for (const w of wrapups) {
        console.log(`    wrapup:${w.id.slice(0,8)} | linked to call:${w.call_id?.slice(0,8) || 'NULL'} | ${w.status} | ${w.summary?.slice(0,60)}`);
      }
    } else {
      console.log(`  Phone ${phone} (call ${c.id.slice(0,8)}): NO wrapups found`);
    }
  }

  // 4. Check total wrapups with "after-hours" agent extension
  const ahWrapups = await sql`
    SELECT count(*) as cnt FROM wrapup_drafts WHERE agent_extension = 'after-hours'
  `;
  console.log(`\nTotal wrapups with agent_extension='after-hours': ${ahWrapups[0].cnt}`);

  // 5. Check if any of these calls' phones have wrapups from a different call
  console.log('\n=== ALL WRAPUPS FOR THESE PHONES (broader search) ===');
  const phones = theseCalls.map(c => c.to_number).filter(Boolean);
  for (const phone of phones) {
    const digits = phone.replace(/\D/g, '').slice(-10);
    const wrapups = await sql`
      SELECT w.id, w.call_id, w.customer_phone, w.created_at, w.summary
      FROM wrapup_drafts w
      WHERE w.customer_phone LIKE ${'%' + digits}
      ORDER BY w.created_at DESC
      LIMIT 2
    `;
    if (wrapups.length > 0) {
      for (const w of wrapups) {
        console.log(`  ${phone} → wrapup:${w.id.slice(0,8)} linked to call:${w.call_id?.slice(0,8)||'NULL'} at ${w.created_at?.toISOString().slice(0,16)}`);
      }
    }
  }

  await sql.end();
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
