require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { calls, wrapupDrafts } = await import('../src/db/schema');
  const { eq, like, or, desc } = await import('drizzle-orm');

  const phones = ['2052663492', '2565252134'];
  
  for (const phone of phones) {
    console.log('\n========================================');
    console.log('Phone:', phone);
    console.log('========================================');
    
    // Find calls
    const callList = await db.select().from(calls)
      .where(or(
        like(calls.fromNumber, '%' + phone + '%'),
        like(calls.toNumber, '%' + phone + '%')
      ))
      .orderBy(desc(calls.startedAt));
    
    console.log('Calls:', callList.length);
    for (const c of callList) {
      console.log('  -', c.id.slice(0,8), '| customerId:', c.customerId?.slice(0,8) || 'NULL', '| azActivity:', c.agencyzoomActivityId || 'NULL');
      
      // Check wrapup
      const [w] = await db.select().from(wrapupDrafts).where(eq(wrapupDrafts.callId, c.id));
      
      if (w) {
        console.log('    Wrapup:', w.id.slice(0,8), '| status:', w.status, '| match:', w.matchStatus, '| posted:', w.noteAutoPosted, '| noteId:', w.agencyzoomNoteId);
      }
    }
  }
}

run().catch(e => console.error(e));
