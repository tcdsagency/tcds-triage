// Quick test of auto-detection logic against the sample CSV headers
const headers = [
  'Customer ID', 'Client Name', 'Carrier', 'Writing Carrier', 'Program',
  'Policy Number', 'Policy State', 'Application Type', 'Policy Title', 'LOB',
  'Statement Date', 'Statement Name', 'Transaction Type', 'Transaction Date',
  'Commission Term', 'Effective Date', 'Expiration Date', 'Reconcile Date',
  'Reporting Date', 'Commissionable Premium', 'Agency Commission %',
  'Commission Paid', 'Agent Paid Date', 'Total Agent Commission',
  'Total Agent Commission %', 'Commission Net Revenue', 'Agent 1',
  'Agent 1 Name', 'Agent 1 Commission %', 'Agent 1 Commission Amount',
  'Agent 2', 'Agent 2 Name', 'Agent 2 Commission %', 'Agent 2 Commission Amount',
  'Agent 3', 'Agent 3 Name', 'Agent 3 Commission %', 'Agent 3 Commission Amount',
  'Policy Office', 'Agent Code', 'Policy Source', 'Billing Type', 'Inception Date'
];

const SYSTEM_FIELDS = [
  { key: "policyNumber", label: "Policy Number", patterns: ["policy number", "policy no", "policy #", "policy_number"] },
  { key: "carrierName", label: "Carrier Name", patterns: ["carrier", "carrier name", "company", "insurance company"] },
  { key: "insuredName", label: "Insured Name", patterns: ["client name", "insured name", "named insured", "insured", "customer name", "name"] },
  { key: "transactionType", label: "Transaction Type", patterns: ["transaction type", "trans type", "type"] },
  { key: "lineOfBusiness", label: "Line of Business", patterns: ["lob", "line of business", "line_of_business"] },
  { key: "effectiveDate", label: "Effective Date", patterns: ["effective date", "eff date", "effective"] },
  { key: "statementDate", label: "Statement Date", patterns: ["statement date"] },
  { key: "agentPaidDate", label: "Agent Paid Date", patterns: ["agent paid date", "paid date", "payment date"] },
  { key: "grossPremium", label: "Gross Premium", patterns: ["commissionable premium", "gross premium", "written premium", "premium"] },
  { key: "commissionRate", label: "Commission Rate", patterns: ["agency commission %", "commission rate", "commission %", "comm rate", "comm %"] },
  { key: "commissionAmount", label: "Commission Amount", patterns: ["commission paid", "commission amount", "commission amt", "comm amount", "comm paid"] },
  { key: "agentCode", label: "Agent Code", patterns: ["agent code", "agent_code", "producer code"] },
];

const autoMap: Record<string, string> = {};
const usedHeaders = new Set<string>();

for (const field of SYSTEM_FIELDS) {
  const headerLower = headers.map(h => h.toLowerCase());
  // Exact match
  for (const pattern of field.patterns) {
    const idx = headerLower.findIndex((h, i) => h === pattern && !usedHeaders.has(headers[i]));
    if (idx >= 0) {
      autoMap[field.key] = headers[idx];
      usedHeaders.add(headers[idx]);
      break;
    }
  }
  // Fuzzy match
  if (!autoMap[field.key]) {
    for (const pattern of field.patterns) {
      const idx = headerLower.findIndex((h, i) => h.includes(pattern) && !usedHeaders.has(headers[i]));
      if (idx >= 0) {
        autoMap[field.key] = headers[idx];
        usedHeaders.add(headers[idx]);
        break;
      }
    }
  }
}

console.log('Auto-mapped fields:');
for (const field of SYSTEM_FIELDS) {
  const mapped = autoMap[field.key];
  console.log(`  ${field.label.padEnd(20)} → ${mapped || '(none)'}`);
}
