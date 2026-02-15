/**
 * Test script for AL3 compiler integration
 * Run with: npx tsx scripts/tmp-test-al3-compiler.ts
 */

import {
  getGroupDefinition,
  getFieldDefinitions,
  getCodedValues,
  validateRecord,
  verifyRoundTrip,
} from '../src/lib/al3/compiler';
import { emitAL3RecordsValidated } from '../src/lib/al3/emitter';
import { generateAL3XMLValidated } from '../src/lib/al3/xml-wrapper';
import type { PolicyCreatorDocument } from '../src/types/policy-creator.types';

// Test document
const testDoc: PolicyCreatorDocument = {
  id: 'test-123',
  tenantId: 'tenant-1',
  originalFileName: 'test.pdf',
  status: 'extracted',
  policyNumber: 'POL-12345',
  carrier: 'Test Insurance Co',
  lineOfBusiness: 'Personal Auto',
  effectiveDate: '2025-01-01',
  expirationDate: '2026-01-01',
  totalPremium: 1200.00,
  insuredFirstName: 'John',
  insuredLastName: 'Doe',
  insuredAddress: '123 Main St',
  insuredCity: 'Anytown',
  insuredState: 'TX',
  insuredZip: '75001',
  vehicles: [
    {
      number: 1,
      year: 2022,
      make: 'Toyota',
      model: 'Camry',
      vin: '1HGBH41JXMN109186',
      usage: 'Pleasure',
      coverages: [
        { code: 'BI', type: 'Bodily Injury', limit: 100000, limit2: 300000, premium: 350 },
        { code: 'PD', type: 'Property Damage', limit: 50000, premium: 150 },
        { code: 'COMP', type: 'Comprehensive', deductible: 500, premium: 100 },
      ],
    },
  ],
  drivers: [
    {
      number: 1,
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1985-06-15',
      licenseNumber: 'D1234567',
      licenseState: 'TX',
      relationship: 'Named Insured',
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

console.log('=== AL3 Compiler Integration Test ===\n');

// Test 1: Group definitions
console.log('1. Testing group definitions...');
const bis = getGroupDefinition('5BIS');
const bpi = getGroupDefinition('5BPI');
console.log(`   5BIS: ${bis?.name} (length: ${bis?.length})`);
console.log(`   5BPI: ${bpi?.name} (length: ${bpi?.length})`);

// Test 2: Field definitions
console.log('\n2. Testing field definitions...');
const bisFields = getFieldDefinitions('5BIS');
const bpiFields = getFieldDefinitions('5BPI');
console.log(`   5BIS fields: ${bisFields.length}`);
console.log(`   5BPI fields: ${bpiFields.length}`);

// Test 3: Coded values
console.log('\n3. Testing coded values...');
const lobCodes = getCodedValues('LOBDES');
console.log(`   LOB codes: ${lobCodes.length} values`);
if (lobCodes.length > 0) {
  console.log(`   Sample: ${lobCodes.slice(0, 3).map(c => c.value).join(', ')}`);
}

// Test 4: Validated emission
console.log('\n4. Testing validated emission...');
const emitResult = emitAL3RecordsValidated(testDoc);
console.log(`   Records emitted: ${emitResult.records.length}`);
console.log(`   Compiler errors: ${emitResult.compilerErrors.length}`);
console.log(`   Compiler warnings: ${emitResult.compilerWarnings.length}`);
console.log(`   Round-trip errors: ${emitResult.roundTripErrors.length}`);
console.log(`   Round-trip warnings: ${emitResult.roundTripWarnings.length}`);
console.log(`   Overall valid: ${emitResult.valid}`);

if (emitResult.compilerErrors.length > 0) {
  console.log('\n   Compiler errors:');
  for (const err of emitResult.compilerErrors.slice(0, 5)) {
    console.log(`   - [${err.groupCode}${err.field ? '.' + err.field : ''}] ${err.message}`);
  }
  if (emitResult.compilerErrors.length > 5) {
    console.log(`   ... and ${emitResult.compilerErrors.length - 5} more`);
  }
}

if (emitResult.compilerWarnings.length > 0) {
  console.log('\n   Compiler warnings:');
  for (const warn of emitResult.compilerWarnings.slice(0, 5)) {
    console.log(`   - ${warn}`);
  }
}

if (emitResult.roundTripErrors.length > 0) {
  console.log('\n   Round-trip errors:');
  for (const err of emitResult.roundTripErrors) {
    console.log(`   - ${err}`);
  }
}

if (emitResult.roundTripWarnings.length > 0) {
  console.log('\n   Round-trip warnings:');
  for (const warn of emitResult.roundTripWarnings.slice(0, 5)) {
    console.log(`   - ${warn}`);
  }
}

// Test 5: Full XML generation with validation
console.log('\n5. Testing full XML generation...');
const genResult = generateAL3XMLValidated(testDoc);
console.log(`   Valid: ${genResult.valid}`);
console.log(`   Record count: ${genResult.recordCount}`);
console.log(`   Raw AL3 length: ${genResult.rawAL3.length} chars`);
console.log(`   XML length: ${genResult.al3xml.length} chars`);

// Show sample records
console.log('\n6. Sample emitted records:');
for (const record of emitResult.records.slice(0, 4)) {
  console.log(`   ${record.groupCode} (${record.length} bytes): ${record.content.substring(0, 50)}...`);
}

console.log('\n=== Test Complete ===');
