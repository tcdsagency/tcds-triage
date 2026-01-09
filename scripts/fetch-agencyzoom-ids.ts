/**
 * Script to fetch AgencyZoom IDs for configuration
 * Run with: npx tsx scripts/fetch-agencyzoom-ids.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getAgencyZoomClient } from '../src/lib/api/agencyzoom';

async function main() {
  console.log('Fetching AgencyZoom configuration data...\n');

  const client = await getAgencyZoomClient();
  if (!client) {
    console.error('AgencyZoom client not configured. Check environment variables.');
    process.exit(1);
  }

  // 1. Search for "No Customer Match" placeholder customer
  console.log('=== Searching for "No Customer Match" placeholder ===');
  try {
    const customers = await client.getCustomers({ search: 'No Customer Match', limit: 5 });
    if (customers.data.length > 0) {
      console.log('Found placeholder customer(s):');
      customers.data.forEach(c => {
        console.log(`  ID: ${c.id}, Name: ${c.businessName || `${c.firstName} ${c.lastName}`}, Email: ${c.email}`);
      });
    } else {
      console.log('No "No Customer Match" placeholder found.');
      console.log('You may need to create one in AgencyZoom first.');
    }
  } catch (e) {
    console.error('Error searching customers:', e);
  }

  // 2. Get service ticket pipelines
  console.log('\n=== Service Ticket Pipelines ===');
  try {
    const pipelines = await client.getServiceTicketPipelines();
    console.log('Available pipelines:');
    pipelines.forEach((p: any) => {
      console.log(`  ID: ${p.id}, Name: ${p.name}`);
      if (p.stages) {
        p.stages.forEach((s: any) => {
          console.log(`    Stage ID: ${s.id}, Name: ${s.name}`);
        });
      }
    });
  } catch (e) {
    console.error('Error fetching pipelines:', e);
  }

  // 3. Get general pipelines (for leads)
  console.log('\n=== Lead/General Pipelines ===');
  try {
    const pipelines = await client.getPipelines();
    console.log('Available pipelines:');
    pipelines.forEach((p: any) => {
      console.log(`  ID: ${p.id}, Name: ${p.name}`);
    });
  } catch (e) {
    console.error('Error fetching lead pipelines:', e);
  }

  // 4. Get a sample of service tickets to see request types
  console.log('\n=== Sample Service Tickets (for request types) ===');
  try {
    const tickets = await client.getServiceTickets({ limit: 20 });
    const requestTypes = new Set<string>();
    tickets.data.forEach((t: any) => {
      if (t.requestType || t.type || t.category) {
        requestTypes.add(t.requestType || t.type || t.category);
      }
    });
    console.log('Found request types:');
    requestTypes.forEach(rt => console.log(`  - ${rt}`));
  } catch (e) {
    console.error('Error fetching service tickets:', e);
  }

  console.log('\n=== Done ===');
  console.log('Update the following files with the correct IDs:');
  console.log('  - src/lib/constants/agencyzoom.ts (NO_MATCH_CUSTOMER.id)');
  console.log('  - src/lib/constants/agencyzoom.ts (SERVICE_REQUEST_TYPE_MAP)');
}

main().catch(console.error);
