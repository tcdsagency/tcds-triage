/**
 * Simple test of Donna API calls
 */
import { getDonnaClient, getDonnaCustomerId } from '../src/lib/api/donna';

async function main() {
  console.log('=== Testing Donna API Calls ===\n');

  const client = getDonnaClient();
  const donnaId = getDonnaCustomerId('1918')!;

  console.log('Testing customer:', donnaId);
  console.log('');

  console.log('1. Fetching customer data...');
  const startData = Date.now();
  const data = await client.getCustomerData(donnaId);
  console.log('   Done in', Date.now() - startData, 'ms');
  console.log('   Got data:', data ? 'yes' : 'no');

  console.log('\n2. Fetching activities...');
  const startAct = Date.now();
  const activities = await client.getActivities(donnaId);
  console.log('   Done in', Date.now() - startAct, 'ms');
  console.log('   Got activities:', activities.length);

  console.log('\n✅ API calls working!');
}

main().catch(console.error);
