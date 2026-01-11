/**
 * Test DONNA Sync Script
 * Run with: npx tsx scripts/test-donna-sync.ts
 */

import { getDonnaClient, getDonnaCustomerId, transformDonnaData } from '../src/lib/api/donna';

async function testDonnaSync() {
  console.log('=== DONNA Sync Test ===\n');

  // Check environment
  console.log('1. Checking environment variables...');
  const hasUsername = !!process.env.DONNA_USERNAME;
  const hasPassword = !!process.env.DONNA_PASSWORD;
  const hasBaseUrl = !!process.env.DONNA_BASE_URL;

  console.log(`   DONNA_USERNAME: ${hasUsername ? '✓ Set' : '✗ Missing'}`);
  console.log(`   DONNA_PASSWORD: ${hasPassword ? '✓ Set' : '✗ Missing'}`);
  console.log(`   DONNA_BASE_URL: ${hasBaseUrl ? '✓ Set' : '✗ Missing'} (${process.env.DONNA_BASE_URL || 'default'})`);

  if (!hasUsername || !hasPassword) {
    console.error('\n❌ Missing DONNA credentials. Cannot proceed.');
    process.exit(1);
  }

  // Test connection
  console.log('\n2. Testing DONNA authentication...');
  try {
    const client = getDonnaClient();
    console.log('   ✓ Client created successfully');

    // Test with a sample customer ID
    const testHawksoftCode = '2944'; // Example HawkSoft client code
    const donnaId = getDonnaCustomerId(testHawksoftCode);
    console.log(`\n3. Testing API call for ${donnaId}...`);

    const data = await client.getCustomerData(donnaId!);

    if (data) {
      console.log('   ✓ Customer data retrieved successfully!');
      console.log('\n   Sample Data:');
      console.log(`   - SentiMeter Value: ${data['KPI SENTIMETER Value'] || 'N/A'}`);
      console.log(`   - Retention Probability: ${data.GbProbabilityRetention || 'N/A'}`);
      console.log(`   - Cross-Sell Probability: ${data.GbProbabilityRoundout || 'N/A'}`);
      console.log(`   - Annual Premium: ${data.DvCustomerAnnualPremium || 'N/A'}`);
      console.log(`   - VIP Personal: ${data.DvCustomerPersonalVIP || 'N/A'}`);
      console.log(`   - Status: ${data.DvCustomerStatus || 'N/A'}`);

      // Transform data
      const transformed = transformDonnaData(data, [], donnaId!);
      console.log('\n   Transformed Data:');
      console.log(`   - Sentiment Score: ${transformed.sentimentScore}`);
      console.log(`   - Retention: ${(transformed.retentionProbability * 100).toFixed(1)}%`);
      console.log(`   - Cross-Sell: ${(transformed.crossSellProbability * 100).toFixed(1)}%`);
      console.log(`   - Current Premium: $${transformed.currentAnnualPremium}`);
      console.log(`   - Wallet Gap: $${transformed.potentialGap}`);
    } else {
      console.log('   ⚠ Customer not found in DONNA');
    }

    console.log('\n✅ DONNA connection working!');
  } catch (error) {
    console.error('\n❌ DONNA test failed:', error);
    process.exit(1);
  }
}

testDonnaSync();
