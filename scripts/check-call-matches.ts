import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL as string);
const db = drizzle(client);

async function check() {
  const callId = process.argv[2] || '32a63a4f-2433-4bdd-91b8-16088c66e66c';

  console.log('=== CALL INFO ===');
  console.log('Call ID:', callId);

  const calls = await db.execute(sql`
    SELECT id, from_number, to_number, direction, customer_id, ai_summary
    FROM calls WHERE id = ${callId}::uuid
  `);

  if (calls.length === 0) {
    console.log('Call not found!');
    await client.end();
    return;
  }

  const call = calls[0] as any;
  console.log('Direction:', call.direction);
  console.log('From:', call.from_number);
  console.log('To:', call.to_number);
  console.log('Customer ID:', call.customer_id || 'Not matched');
  console.log('AI Summary:', call.ai_summary?.substring(0, 100) + '...');

  console.log('\n=== WRAPUP DRAFT ===');
  const wrapups = await db.execute(sql`
    SELECT id, customer_name, customer_phone, match_status, ai_extraction
    FROM wrapup_drafts WHERE call_id = ${callId}::uuid
  `);

  if (wrapups.length === 0) {
    console.log('No wrapup found for this call!');
    await client.end();
    return;
  }

  const wrapup = wrapups[0] as any;
  console.log('Wrapup ID:', wrapup.id);
  console.log('Customer Name:', wrapup.customer_name);
  console.log('Customer Phone:', wrapup.customer_phone);
  console.log('Match Status:', wrapup.match_status);

  if (wrapup.ai_extraction) {
    console.log('AI Extraction - AZ Customer ID:', wrapup.ai_extraction?.agencyZoomCustomerId);
    console.log('AI Extraction - AZ Lead ID:', wrapup.ai_extraction?.agencyZoomLeadId);
  }

  console.log('\n=== MATCH SUGGESTIONS ===');
  const suggestions = await db.execute(sql`
    SELECT id, source, contact_type, contact_id, contact_name, contact_phone, contact_email, match_reason, confidence
    FROM match_suggestions WHERE wrapup_draft_id = ${wrapup.id}::uuid
    ORDER BY confidence DESC
  `);

  console.log('Found', suggestions.length, 'suggestions:');

  if (suggestions.length > 0) {
    (suggestions as any[]).forEach((s, i) => {
      console.log(`\n${i+1}. ${s.contact_name}`);
      console.log(`   Type: ${s.contact_type}`);
      console.log(`   ID: ${s.contact_id}`);
      console.log(`   Phone: ${s.contact_phone}`);
      console.log(`   Email: ${s.contact_email}`);
      console.log(`   Confidence: ${s.confidence}`);
      console.log(`   Reason: ${s.match_reason}`);
    });
  } else {
    console.log('No match suggestions stored!');
  }

  await client.end();
}

check().catch(console.error);
