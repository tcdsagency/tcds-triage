/**
 * Inspect HawkSoft Policy-Level Agent Fields
 * ============================================
 * Fetches raw HawkSoft client data (bypassing normalizeClient) to discover
 * policy-level agent/producer fields.
 *
 * Per HawkSoft API v3 docs, policies should have:
 *   Agent1, Agent2, Agent3 — policy-level agents (writing/commission)
 *   AgentCode — carrier-assigned agent code
 *
 * Client details should have:
 *   Producer — originating agent
 *   CSR — servicing rep
 *
 * Usage: npx tsx scripts/tmp-inspect-hawksoft-policy-fields.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const HAWKSOFT_CLIENT_ID = process.env.HAWKSOFT_CLIENT_ID!;
const HAWKSOFT_CLIENT_SECRET = process.env.HAWKSOFT_CLIENT_SECRET!;
const HAWKSOFT_AGENCY_ID = process.env.HAWKSOFT_AGENCY_ID!;
const BASE_URL = 'https://integration.hawksoft.app';

const authHeader = 'Basic ' + Buffer.from(`${HAWKSOFT_CLIENT_ID}:${HAWKSOFT_CLIENT_SECRET}`).toString('base64');

async function rawRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${BASE_URL}${endpoint}${separator}version=3.0`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HawkSoft API error: ${response.status} ${error}`);
  }

  return response.json();
}

// Known HawkSoft agent field names (case-insensitive search)
const KNOWN_AGENT_FIELDS = ['Agent1', 'Agent2', 'Agent3', 'AgentCode', 'Producer', 'CSR'];

// Recursively search for keys containing agent-related terms
function findAgentFields(obj: any, path: string = '', results: string[] = []): string[] {
  if (!obj || typeof obj !== 'object') return results;

  const agentTerms = /agent|producer|csr|servicing|rep\b|writer|broker/i;

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = path ? `${path}.${key}` : key;

    if (agentTerms.test(key)) {
      results.push(`${fullPath} = ${JSON.stringify(value)}`);
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      findAgentFields(value, fullPath, results);
    }
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      findAgentFields(value[0], `${fullPath}[0]`, results);
    }
  }

  return results;
}

async function main() {
  // Pull known HawkSoft client codes from our DB
  console.log('Querying DB for customers with HawkSoft codes...\n');
  const { db } = await import('../src/db');
  const { customers } = await import('../src/db/schema');
  const { isNotNull } = await import('drizzle-orm');

  const dbCustomers = await db
    .select({ hawksoftClientCode: customers.hawksoftClientCode })
    .from(customers)
    .where(isNotNull(customers.hawksoftClientCode))
    .limit(10);

  const sampleIds = dbCustomers
    .map(c => parseInt(c.hawksoftClientCode!))
    .filter(n => !isNaN(n));

  if (sampleIds.length === 0) {
    console.log('No customers with HawkSoft codes found in DB');
    return;
  }

  console.log(`Inspecting ${sampleIds.length} clients: ${sampleIds.join(', ')}\n`);

  // Fetch with full includes but NO normalization
  const rawClients = await rawRequest<any[]>(
    `/vendor/agency/${HAWKSOFT_AGENCY_ID}/clients?include=details,policies`,
    {
      method: 'POST',
      body: JSON.stringify({ clientNumbers: sampleIds }),
    }
  );

  // Summary table
  const agentSummary: { client: number; policy: string; agent1: string; agent2: string; agent3: string; agentCode: string; clientProducer: string; clientCsr: string }[] = [];

  for (const client of rawClients) {
    console.log('='.repeat(80));
    console.log(`Client #${client.clientNumber}`);

    const details = client.details || {};
    console.log(`  Client Producer: ${JSON.stringify(details.Producer ?? details.producer)}`);
    console.log(`  Client CSR:      ${JSON.stringify(details.CSR ?? details.csr)}`);

    const clientProducer = details.Producer || details.producer || '';
    const clientCsr = details.CSR || details.csr || '';

    // Inspect each policy
    const pols = client.policies || [];
    console.log(`  Policies: ${pols.length}`);

    for (const policy of pols) {
      const pNum = policy.policyNumber || '?';
      const title = policy.title || policy.type || 'unknown';
      console.log(`\n  Policy: ${pNum} (${title})`);

      // Specifically check for known agent fields
      const a1 = policy.Agent1 ?? policy.agent1 ?? null;
      const a2 = policy.Agent2 ?? policy.agent2 ?? null;
      const a3 = policy.Agent3 ?? policy.agent3 ?? null;
      const ac = policy.AgentCode ?? policy.agentCode ?? null;

      console.log(`    Agent1:    ${JSON.stringify(a1)}`);
      console.log(`    Agent2:    ${JSON.stringify(a2)}`);
      console.log(`    Agent3:    ${JSON.stringify(a3)}`);
      console.log(`    AgentCode: ${JSON.stringify(ac)}`);

      agentSummary.push({
        client: client.clientNumber,
        policy: pNum,
        agent1: a1 || '',
        agent2: a2 || '',
        agent3: a3 || '',
        agentCode: ac || '',
        clientProducer,
        clientCsr,
      });

      // Also scan for any OTHER agent-related fields we might miss
      const allAgentFields = findAgentFields(policy, 'policy');
      const unknownFields = allAgentFields.filter(f => !KNOWN_AGENT_FIELDS.some(k => f.includes(k)));
      if (unknownFields.length > 0) {
        console.log('    Other agent-related fields:');
        for (const f of unknownFields) console.log(`      ${f}`);
      }

      // Show full policy JSON for first policy per client (sans large arrays)
      if (pols.indexOf(policy) === 0) {
        const stripped = { ...policy };
        delete stripped.coverages;
        delete stripped.autos;
        delete stripped.locations;
        delete stripped.drivers;
        delete stripped.additionalInterests;
        delete stripped.loBs;
        console.log('    Full policy (sans nested arrays):');
        console.log('    ' + JSON.stringify(stripped, null, 2).replace(/\n/g, '\n    '));
      }
    }
    console.log();
  }

  // Print summary table
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY: Policy-Level Agent Fields');
  console.log('='.repeat(80));
  console.log(
    'Client'.padEnd(10) +
    'Policy'.padEnd(20) +
    'Agent1'.padEnd(12) +
    'Agent2'.padEnd(12) +
    'Agent3'.padEnd(12) +
    'AgentCode'.padEnd(15) +
    'ClientProd'.padEnd(12) +
    'ClientCSR'
  );
  console.log('-'.repeat(105));
  for (const row of agentSummary) {
    console.log(
      String(row.client).padEnd(10) +
      row.policy.padEnd(20) +
      (row.agent1 || '-').padEnd(12) +
      (row.agent2 || '-').padEnd(12) +
      (row.agent3 || '-').padEnd(12) +
      (row.agentCode || '-').padEnd(15) +
      (row.clientProducer || '-').padEnd(12) +
      (row.clientCsr || '-')
    );
  }
}

main().catch(console.error).finally(() => process.exit(0));
