/**
 * PDF Extraction → RenewalSnapshot Converter
 * ============================================
 * Maps Claude PDF extraction output to the canonical RenewalSnapshot shape
 * that compareSnapshots() expects.
 */

import type { ExtractedPolicyData } from '@/types/policy-creator.types';
import type {
  RenewalSnapshot,
  CanonicalCoverage,
  CanonicalVehicle,
  CanonicalDriver,
  CanonicalDiscount,
  CanonicalMortgagee,
} from '@/types/renewal.types';
import { COVERAGE_CODE_MAP } from '@/lib/al3/constants';

/**
 * Convert PDF extraction output into a RenewalSnapshot for the comparison engine.
 */
export function convertPdfExtractionToRenewalSnapshot(
  extracted: ExtractedPolicyData
): RenewalSnapshot {
  // Map coverages
  const allCoverages: CanonicalCoverage[] = (extracted.coverages || []).map((c) => ({
    type: COVERAGE_CODE_MAP[c.code?.toUpperCase() || ''] || c.code || 'unknown',
    description: c.description || c.code || 'Unknown',
    limit: c.limit != null ? String(c.limit) : undefined,
    limitAmount: c.limit ?? undefined,
    deductible: c.deductible != null ? String(c.deductible) : undefined,
    deductibleAmount: c.deductible ?? undefined,
    premium: c.premium ?? undefined,
  }));

  // Separate policy-level vs vehicle-level coverages
  const policyCoverages = allCoverages.filter((_, i) => {
    const raw = extracted.coverages?.[i];
    return !raw?.vehicleNumber;
  });

  const vehicleCoveragesByNum = new Map<number, CanonicalCoverage[]>();
  (extracted.coverages || []).forEach((c, i) => {
    if (c.vehicleNumber) {
      const existing = vehicleCoveragesByNum.get(c.vehicleNumber) || [];
      existing.push(allCoverages[i]);
      vehicleCoveragesByNum.set(c.vehicleNumber, existing);
    }
  });

  // Map vehicles
  const vehicles: CanonicalVehicle[] = (extracted.vehicles || []).map((v) => ({
    vin: v.vin,
    year: v.year,
    make: v.make,
    model: v.model,
    usage: v.usage,
    annualMileage: v.annualMileage,
    coverages: vehicleCoveragesByNum.get(v.number || 0) || [],
  }));

  // Map drivers
  const drivers: CanonicalDriver[] = (extracted.drivers || []).map((d) => ({
    name: [d.firstName, d.lastName].filter(Boolean).join(' ') || undefined,
    dateOfBirth: d.dateOfBirth,
    licenseNumber: d.licenseNumber,
    licenseState: d.licenseState,
    relationship: d.relationship,
    isExcluded: d.excluded,
  }));

  // Map discounts
  const discounts: CanonicalDiscount[] = (extracted.discounts || []).map((d) => ({
    code: d.code || '',
    description: d.description || d.code || 'Unknown',
    amount: d.amount,
    percent: d.percent,
  }));

  // Map mortgagees
  const interestTypeMap: Record<string, CanonicalMortgagee['type']> = {
    MG: 'mortgagee',
    LH: 'lienholder',
    LP: 'loss_payee',
    AI: 'additional_interest',
  };

  const mortgagees: CanonicalMortgagee[] = (extracted.mortgagees || []).map((m) => ({
    name: m.name || '',
    type: interestTypeMap[m.interestType?.toUpperCase() || 'MG'] || 'mortgagee',
    loanNumber: m.loanNumber,
    address: m.address,
    city: m.city,
    state: m.state,
    zip: m.zip,
  }));

  // Build insured name
  const insuredName =
    extracted.insuredName ||
    [extracted.insuredFirstName, extracted.insuredLastName].filter(Boolean).join(' ') ||
    undefined;

  // Compute overall confidence
  const confidences = extracted.confidence || {};
  const confValues = Object.values(confidences).filter(
    (v): v is number => typeof v === 'number' && !isNaN(v)
  );
  const parseConfidence =
    confValues.length > 0
      ? confValues.reduce((a, b) => a + b, 0) / confValues.length
      : 0.7; // Default for PDF extraction

  return {
    insuredName,
    insuredAddress: extracted.insuredAddress,
    insuredCity: extracted.insuredCity,
    insuredState: extracted.insuredState,
    insuredZip: extracted.insuredZip,
    insuredEmail: extracted.insuredEmail,
    insuredPhone: extracted.insuredPhone,
    premium: extracted.totalPremium ?? undefined,
    coverages: policyCoverages,
    vehicles,
    drivers,
    endorsements: [], // PDFs rarely have structured endorsement data
    discounts,
    claims: [], // PDFs don't include claims history
    mortgagees,
    parseConfidence,
    parsedAt: new Date().toISOString(),
    sourceFileName: 'pdf_upload',
  };
}
