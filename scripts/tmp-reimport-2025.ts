import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import * as fs from 'fs';

async function main() {
  const { parseCSV, parseCurrency, parseDate, parsePercentage } = await import('../src/lib/commissions/csv-parser');
  const { db } = await import('../src/db');
  const { commissionImportBatches, commissionFieldMappings, commissionTransactions, commissionImportErrors } = await import('../src/db/schema');
  const { eq, and } = await import('drizzle-orm');
  const { generateDedupeHash } = await import('../src/lib/commissions/dedup');
  const { getReportingMonth } = await import('../src/lib/commissions/month-utils');

  const tenantId = process.env.DEFAULT_TENANT_ID!;

  // Step 0: Clear previous import data
  console.log('=== Clearing previous import data ===');
  const delTxn = await db.delete(commissionTransactions).where(eq(commissionTransactions.tenantId, tenantId));
  console.log('  Deleted transactions');
  const delErr = await db.delete(commissionImportErrors).where(eq(commissionImportErrors.tenantId, tenantId));
  console.log('  Deleted import errors');
  const delBatch = await db.delete(commissionImportBatches).where(eq(commissionImportBatches.tenantId, tenantId));
  console.log('  Deleted batches');

  // Step 1: Parse CSV
  const csvText = fs.readFileSync('C:\\Users\\ToddConn\\Downloads\\Export-02_08_2026.csv', 'utf-8');
  const { headers, records } = parseCSV(csvText);
  console.log(`\nParsed ${records.length} rows, ${headers.length} headers`);

  // Step 2: Create batch
  const [batch] = await db.insert(commissionImportBatches).values({
    tenantId,
    fileName: 'Export-02_08_2026.csv',
    status: 'importing',
    rawData: records,
    parsedHeaders: headers,
    totalRows: records.length,
    startedAt: new Date(),
  }).returning();
  console.log('Batch:', batch.id);

  // Step 3: Field mapping
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
    'Agent 2': 'agent2Code',
    'Agent 2 Name': 'agent2Name',
    'Agent 2 Commission %': 'agent2Percent',
    'Agent 2 Commission Amount': 'agent2Amount',
  };

  const [savedMapping] = await db.insert(commissionFieldMappings).values({
    tenantId, name: '2025 HawkSoft Export', mapping, csvHeaders: headers, isDefault: true,
  }).returning();

  await db.update(commissionImportBatches).set({
    fieldMappingId: savedMapping.id,
  }).where(eq(commissionImportBatches.id, batch.id));

  // Build reverse mapping
  const reverseMapping: Record<string, string> = {};
  for (const [csvCol, sysField] of Object.entries(mapping)) {
    reverseMapping[sysField] = csvCol;
  }

  const AMOUNT_FIELDS = ['grossPremium', 'commissionAmount', 'agent1Amount', 'agent2Amount'];
  const DATE_FIELDS = ['effectiveDate', 'statementDate', 'agentPaidDate'];

  function normalizeTransactionType(raw: string) {
    if (!raw) return 'other';
    const lower = raw.toLowerCase().trim();
    if (['new business', 'new', 'nb', 'new_business'].includes(lower)) return 'new_business';
    if (['renewal', 'renew', 'rn'].includes(lower)) return 'renewal';
    if (['cancellation', 'cancel', 'cx', 'cancelled'].includes(lower)) return 'cancellation';
    if (['endorsement', 'endorse', 'policy change', 'change', 'pc'].includes(lower)) return 'endorsement';
    if (['return premium', 'return', 'return_premium', 'rp'].includes(lower)) return 'return_premium';
    if (['bonus'].includes(lower)) return 'bonus';
    if (['override'].includes(lower)) return 'override';
    if (['contingency'].includes(lower)) return 'contingency';
    return 'other';
  }

  // Step 4: Process all rows — deduplicate in memory, then batch insert
  let importedRows = 0;
  let skippedRows = 0;
  let errorRows = 0;
  let duplicateRows = 0;
  const startTime = Date.now();
  const seenHashes = new Set<string>();

  const BATCH_SIZE = 50;
  let insertBuffer: any[] = [];

  async function flushBuffer() {
    if (insertBuffer.length === 0) return;
    try {
      await db.insert(commissionTransactions).values(insertBuffer);
    } catch (batchErr: any) {
      // Fall back to single-row inserts on batch failure
      for (const row of insertBuffer) {
        try {
          await db.insert(commissionTransactions).values(row);
        } catch (singleErr: any) {
          errorRows++;
          importedRows--;
          if (errorRows <= 15) {
            console.log(`  FALLBACK ERROR: ${singleErr.message?.substring(0, 120)}`);
          }
        }
      }
    }
    insertBuffer = [];
  }

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNumber = i + 1;

    if (i % 1000 === 0 && i > 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (importedRows / (Date.now() - startTime) * 1000).toFixed(0);
      console.log(`  Row ${i}/${records.length} (${elapsed}s, ${rate}/s) — imported=${importedRows} dupes=${duplicateRows} errors=${errorRows}`);
    }

    try {
      const mapped: Record<string, unknown> = {};

      for (const [sysField, csvCol] of Object.entries(reverseMapping)) {
        const normalizedKey = csvCol.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        const rawValue = row[normalizedKey] || '';

        if (AMOUNT_FIELDS.includes(sysField)) {
          mapped[sysField] = parseCurrency(rawValue);
        } else if (DATE_FIELDS.includes(sysField)) {
          mapped[sysField] = parseDate(rawValue);
        } else if (sysField === 'commissionRate' || sysField === 'agent1Percent' || sysField === 'agent2Percent') {
          mapped[sysField] = parsePercentage(rawValue);
        } else {
          mapped[sysField] = rawValue;
        }
      }

      if (!mapped.policyNumber) throw new Error('Missing required field: policyNumber');
      if (mapped.commissionAmount == null) throw new Error('Missing required field: commissionAmount');

      const dedupeHash = generateDedupeHash({
        policyNumber: (mapped.policyNumber as string) || '',
        carrierName: (mapped.carrierName as string) || '',
        commissionAmount: String(mapped.commissionAmount),
        effectiveDate: (mapped.effectiveDate as string) || '',
        transactionType: (mapped.transactionType as string) || '',
        statementDate: (mapped.statementDate as string) || '',
        agentPaidDate: (mapped.agentPaidDate as string) || '',
      });

      // In-memory dedupe within this import
      if (seenHashes.has(dedupeHash)) {
        duplicateRows++;
        skippedRows++;
        continue;
      }
      seenHashes.add(dedupeHash);

      const reportingMonth = getReportingMonth((mapped.agentPaidDate as string) || null);

      const agentParts: string[] = [];
      if (mapped.agent1Code || mapped.agent1Name) {
        const pct = mapped.agent1Percent != null ? `${(Number(mapped.agent1Percent) * 100).toFixed(0)}%` : '';
        agentParts.push(`Agent 1: ${mapped.agent1Code || ''} ${mapped.agent1Name || ''} ${pct} ${mapped.agent1Amount != null ? '$' + mapped.agent1Amount : ''}`.trim());
      }
      if (mapped.agent2Code || mapped.agent2Name) {
        const pct = mapped.agent2Percent != null ? `${(Number(mapped.agent2Percent) * 100).toFixed(0)}%` : '';
        agentParts.push(`Agent 2: ${mapped.agent2Code || ''} ${mapped.agent2Name || ''} ${pct} ${mapped.agent2Amount != null ? '$' + mapped.agent2Amount : ''}`.trim());
      }

      insertBuffer.push({
        tenantId,
        importBatchId: batch.id,
        policyNumber: mapped.policyNumber as string,
        carrierName: (mapped.carrierName as string) || null,
        insuredName: (mapped.insuredName as string) || null,
        transactionType: normalizeTransactionType((mapped.transactionType as string) || '') as any,
        lineOfBusiness: (mapped.lineOfBusiness as string) || null,
        effectiveDate: (mapped.effectiveDate as string) || null,
        statementDate: (mapped.statementDate as string) || null,
        agentPaidDate: (mapped.agentPaidDate as string) || null,
        grossPremium: mapped.grossPremium != null ? String(mapped.grossPremium) : null,
        commissionRate: mapped.commissionRate != null ? String(mapped.commissionRate) : null,
        commissionAmount: String(mapped.commissionAmount),
        reportingMonth,
        dedupeHash,
        notes: agentParts.length > 0 ? agentParts.join(' | ') : null,
      });

      if (insertBuffer.length >= BATCH_SIZE) {
        await flushBuffer();
      }

      importedRows++;
    } catch (rowError: any) {
      await flushBuffer();
      errorRows++;
      if (errorRows <= 15) {
        console.log(`  ERROR row ${rowNumber}: ${rowError.message?.substring(0, 120)}`);
      }
      await db.insert(commissionImportErrors).values({
        tenantId,
        batchId: batch.id,
        rowNumber,
        errorMessage: rowError.message || 'Unknown error',
        rawRow: row,
      });
    }
  }

  // Flush remaining
  await flushBuffer();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const finalStatus = importedRows === 0 && errorRows > 0 ? 'failed' : 'completed';
  await db.update(commissionImportBatches).set({
    status: finalStatus,
    importedRows,
    skippedRows,
    errorRows,
    duplicateRows,
    completedAt: new Date(),
  }).where(eq(commissionImportBatches.id, batch.id));

  console.log(`\n=== IMPORT COMPLETE (${elapsed}s) ===`);
  console.log(`  Imported:   ${importedRows}`);
  console.log(`  Duplicates: ${duplicateRows}`);
  console.log(`  Errors:     ${errorRows}`);
  console.log(`  Total:      ${records.length}`);

  process.exit(0);
}
main();
