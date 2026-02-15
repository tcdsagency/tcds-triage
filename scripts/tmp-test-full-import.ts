import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';

async function main() {
  const { parseCSV, parseCurrency, parseDate } = await import('../src/lib/commissions/csv-parser');
  const { db } = await import('../src/db');
  const { commissionImportBatches, commissionFieldMappings, commissionTransactions } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { generateDedupeHash } = await import('../src/lib/commissions/dedup');
  const { getReportingMonth } = await import('../src/lib/commissions/month-utils');

  const tenantId = process.env.DEFAULT_TENANT_ID!;
  const csvText = fs.readFileSync('C:\\Users\\ToddConn\\Downloads\\Export-02_07_2026.csv', 'utf-8');
  const { headers, records } = parseCSV(csvText);

  console.log('=== Step 1: Create batch ===');
  const [batch] = await db.insert(commissionImportBatches).values({
    tenantId, fileName: 'test.csv', status: 'parsing',
    rawData: records, parsedHeaders: headers, totalRows: records.length,
    startedAt: new Date(),
  }).returning();
  console.log('Batch:', batch.id);

  // Simulate mapping (like auto-detect would do)
  const mapping: Record<string, string> = {
    'Policy Number': 'policyNumber',
    'Carrier': 'carrierName',
    'Client Name': 'insuredName',
    'Transaction Type': 'transactionType',
    'LOB': 'lineOfBusiness',
    'Effective Date': 'effectiveDate',
    'Statement Date': 'statementDate',
    'Agent Paid Date': 'agentPaidDate',
    'Commissionable Premium': 'grossPremium',
    'Agency Commission %': 'commissionRate',
    'Commission Paid': 'commissionAmount',
    'Agent Code': 'agentCode',
    'Agent 1': 'agent1Code',
    'Agent 1 Name': 'agent1Name',
    'Agent 1 Commission %': 'agent1Percent',
    'Agent 1 Commission Amount': 'agent1Amount',
  };

  console.log('\n=== Step 2: Save mapping ===');
  const [savedMapping] = await db.insert(commissionFieldMappings).values({
    tenantId, name: 'Test', mapping, csvHeaders: headers, isDefault: false,
  }).returning();

  await db.update(commissionImportBatches).set({
    status: 'previewing', fieldMappingId: savedMapping.id,
  }).where(eq(commissionImportBatches.id, batch.id));

  console.log('\n=== Step 3: Process row (simulating execute) ===');
  const reverseMapping: Record<string, string> = {};
  for (const [csvCol, sysField] of Object.entries(mapping)) {
    reverseMapping[sysField] = csvCol;
  }

  const AMOUNT_FIELDS = ['grossPremium', 'commissionAmount', 'agent1Amount', 'agent2Amount'];
  const DATE_FIELDS = ['effectiveDate', 'statementDate', 'agentPaidDate'];

  const row = records[0];
  const mapped: Record<string, unknown> = {};

  for (const [sysField, csvCol] of Object.entries(reverseMapping)) {
    const normalizedKey = csvCol.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const rawValue = row[normalizedKey] || '';
    if (AMOUNT_FIELDS.includes(sysField)) {
      mapped[sysField] = parseCurrency(rawValue);
    } else if (DATE_FIELDS.includes(sysField)) {
      mapped[sysField] = parseDate(rawValue);
    } else {
      mapped[sysField] = rawValue;
    }
  }

  console.log('Mapped data:', JSON.stringify(mapped, null, 2));

  // Normalize transaction type
  function normalizeTransactionType(raw: string) {
    if (!raw) return 'other';
    const lower = raw.toLowerCase().trim();
    if (['new business', 'new', 'nb', 'new_business'].includes(lower)) return 'new_business';
    if (['renewal', 'renew', 'rn'].includes(lower)) return 'renewal';
    if (['cancellation', 'cancel', 'cx', 'cancelled'].includes(lower)) return 'cancellation';
    if (['endorsement', 'endorse', 'policy change', 'change', 'pc'].includes(lower)) return 'endorsement';
    if (['return premium', 'return', 'return_premium', 'rp'].includes(lower)) return 'return_premium';
    return 'other';
  }

  const txnType = normalizeTransactionType((mapped.transactionType as string) || '');
  console.log('Transaction type:', mapped.transactionType, '→', txnType);

  const dedupeHash = generateDedupeHash({
    policyNumber: (mapped.policyNumber as string) || '',
    carrierName: (mapped.carrierName as string) || '',
    commissionAmount: String(mapped.commissionAmount),
    effectiveDate: (mapped.effectiveDate as string) || '',
    transactionType: (mapped.transactionType as string) || '',
  });

  const reportingMonth = getReportingMonth((mapped.agentPaidDate as string) || null);
  console.log('Reporting month:', reportingMonth);

  try {
    const [txn] = await db.insert(commissionTransactions).values({
      tenantId,
      importBatchId: batch.id,
      policyNumber: mapped.policyNumber as string,
      carrierName: (mapped.carrierName as string) || null,
      insuredName: (mapped.insuredName as string) || null,
      transactionType: txnType as any,
      lineOfBusiness: (mapped.lineOfBusiness as string) || null,
      effectiveDate: (mapped.effectiveDate as string) || null,
      statementDate: (mapped.statementDate as string) || null,
      agentPaidDate: (mapped.agentPaidDate as string) || null,
      grossPremium: mapped.grossPremium != null ? String(mapped.grossPremium) : null,
      commissionRate: null,
      commissionAmount: String(mapped.commissionAmount),
      reportingMonth,
      dedupeHash,
      notes: `Agent 1: ${mapped.agent1Code} ${mapped.agent1Name} ${mapped.agent1Percent} $${mapped.agent1Amount}`,
    }).returning();
    console.log('\nTransaction inserted:', txn.id);
    console.log('  Policy:', txn.policyNumber);
    console.log('  Carrier:', txn.carrierName);
    console.log('  Type:', txn.transactionType);
    console.log('  Amount:', txn.commissionAmount);
    console.log('  Notes:', txn.notes);

    // Clean up
    await db.delete(commissionTransactions).where(eq(commissionTransactions.id, txn.id));
    console.log('Transaction cleaned up');
  } catch (err) {
    console.error('INSERT FAILED:', err);
  }

  // Clean up batch and mapping
  await db.delete(commissionImportBatches).where(eq(commissionImportBatches.id, batch.id));
  await db.delete(commissionFieldMappings).where(eq(commissionFieldMappings.id, savedMapping.id));
  console.log('Batch and mapping cleaned up');

  console.log('\n=== SUCCESS ===');
  process.exit(0);
}

main();
