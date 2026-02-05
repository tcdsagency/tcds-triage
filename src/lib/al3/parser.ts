/**
 * AL3 Parser
 * ==========
 * Parses ACORD AL3 flat files into structured transaction data.
 * Three-tier strategy:
 *   1. Regex extraction for common fields
 *   2. Position-based for AL3 standard fields
 *   3. Carrier-specific overrides from carrierProfiles
 */

import type {
  AL3ParsedTransaction,
  AL3TransactionHeader,
  AL3Coverage,
  AL3Vehicle,
  AL3Driver,
  AL3Location,
  AL3Discount,
  AL3Claim,
  AL3Endorsement,
} from '@/types/renewal.types';
import {
  AL3_GROUP_CODES,
  TRG_FIELDS,
  CVG_FIELDS,
  CVA_FIELDS,
  CVH_FIELDS,
  VEH_FIELDS,
  DRV_FIELDS,
  DSC_FIELDS,
  CLM_FIELDS,
  END_FIELDS,
  FOR_FIELDS,
  LOB_CODES,
} from './constants';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Parse an AL3 date string (YYYYMMDD) to ISO string.
 */
export function parseAL3Date(dateStr: string): string | undefined {
  const trimmed = dateStr.trim();
  if (!trimmed || trimmed.length < 8 || trimmed === '00000000') return undefined;

  const year = trimmed.substring(0, 4);
  const month = trimmed.substring(4, 6);
  const day = trimmed.substring(6, 8);

  const parsed = new Date(`${year}-${month}-${day}`);
  if (isNaN(parsed.getTime())) return undefined;

  return `${year}-${month}-${day}`;
}

/**
 * Parse an AL3 numeric field, trimming whitespace and removing non-numeric chars.
 */
export function parseAL3Number(str: string): number | undefined {
  const trimmed = str.trim().replace(/[^0-9.-]/g, '');
  if (!trimmed) return undefined;
  const num = parseFloat(trimmed);
  return isNaN(num) ? undefined : num;
}

/**
 * Extract a fixed-width field from a line.
 * Truncates at field separators (EDIFACT control chars) used by some carriers.
 */
function extractField(line: string, pos: { start: number; end: number }): string {
  const raw = line.substring(pos.start, pos.end) || '';
  // Truncate at the first EDIFACT field separator (0xFA-0xFF range or control chars < 0x20 except space)
  // These separators indicate field boundaries in SAFECO/Universal format variants
  let end = raw.length;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if ((c >= 0xFA && c <= 0xFF) || (c < 0x20 && c !== 0x20)) {
      end = i;
      break;
    }
  }
  return raw.substring(0, end).trim();
}

/**
 * Identify the group code of an AL3 record line.
 */
function getGroupCode(line: string): string {
  return line.substring(0, 4);
}

// =============================================================================
// RECORD SPLITTING
// =============================================================================

/**
 * Known AL3 group code prefixes (first character indicates record level).
 * Used to detect record boundaries in concatenated (no-newline) AL3 streams.
 */
const KNOWN_GROUP_CODE_PATTERN = /^[0-9][A-Z]{3}/;

/**
 * Split a concatenated AL3 stream into individual record lines.
 *
 * IVANS AL3 files use fixed-width records. Each record starts with a 4-char
 * group code (e.g. 1MHG, 2TRG, 5BIS) followed by a 3-char record length.
 * Records may be concatenated without newlines. This function detects that
 * case and splits by walking the length fields.
 */
export function splitAL3Records(content: string): string[] {
  // First try normal line splitting
  const lines = content.split(/\r?\n/).filter((l) => l.length >= 4);

  // If we got multiple lines, the file has normal line breaks
  if (lines.length > 1) {
    return lines;
  }

  // Single line — likely concatenated fixed-width records.
  // Walk through using the record length field (chars 4-7, 3 digits).
  const raw = lines[0] || content;
  if (raw.length < 7) return lines;

  const records: string[] = [];
  let pos = 0;

  while (pos < raw.length) {
    // Need at least 7 chars for group code (4) + length (3)
    if (pos + 7 > raw.length) {
      break;
    }

    const groupCode = raw.substring(pos, pos + 4);

    // Verify this looks like a valid group code
    if (!KNOWN_GROUP_CODE_PATTERN.test(groupCode)) {
      pos++;
      continue;
    }

    const lengthStr = raw.substring(pos + 4, pos + 7).trim();
    const recordLength = parseInt(lengthStr, 10);

    if (isNaN(recordLength) || recordLength < 7 || recordLength > 1000) {
      // Invalid length — skip this match and keep scanning
      pos++;
      continue;
    }

    // Extract the record
    const record = raw.substring(pos, pos + recordLength);
    records.push(record);

    // Some carriers (e.g., Universal/SAFECO) embed sub-records within container records
    // like 1MHG or 2TCG. Scan the container content for embedded records, but extract
    // from the FULL raw stream to get complete records even if they overflow the container.
    if (groupCode === '1MHG' || groupCode === '2TCG' || groupCode === '9BIS') {
      extractEmbeddedRecords(raw, pos, recordLength, records);
    }

    pos += recordLength;
  }

  return records.length > 0 ? records : lines;
}

/**
 * Scan a container record for embedded sub-records.
 * Some carriers embed 2TRG, 5BIS, 5BPI etc. inside 1MHG or 2TCG records.
 * Embedded records may overflow the container boundary — we extract from the
 * full raw stream to get the complete record.
 */
function extractEmbeddedRecords(
  raw: string,
  containerStart: number,
  containerLength: number,
  records: string[]
): void {
  const embeddedCodes = ['2TRG', '5BIS', '5BPI'];
  const searchEnd = containerStart + containerLength;

  for (const code of embeddedCodes) {
    let searchPos = containerStart + 8; // Skip the container's own header
    while (searchPos < searchEnd - 4) {
      const idx = raw.indexOf(code, searchPos);
      if (idx === -1 || idx >= searchEnd) break;

      const lenStr = raw.substring(idx + 4, idx + 7).trim();
      const len = parseInt(lenStr, 10);
      if (!isNaN(len) && len >= 7 && len <= 1000) {
        // Extract from the FULL raw stream, not just the container
        const embedded = raw.substring(idx, idx + len);
        if (embedded.length >= 7) {
          records.push(embedded);
        }
      }
      searchPos = idx + 1;
    }
  }
}

// =============================================================================
// MAIN PARSER
// =============================================================================

/**
 * Parse an entire AL3 file into parsed transactions.
 * Splits by transaction boundaries (2TRG...3MTG) and parses each.
 * Handles both line-delimited and concatenated (no-newline) AL3 formats.
 */
export function parseAL3File(content: string): AL3ParsedTransaction[] {
  const lines = splitAL3Records(content);
  const transactions: AL3ParsedTransaction[] = [];

  let currentLines: string[] = [];
  let inTransaction = false;

  let lastTrgLine: string | null = null; // Track 2TRG for multi-2TCG formats

  for (const line of lines) {
    const groupCode = getGroupCode(line);

    if (groupCode === AL3_GROUP_CODES.TRANSACTION_HEADER) {
      // Start a new transaction
      if (inTransaction && currentLines.length > 0) {
        // Close previous (missing trailer)
        const parsed = parseTransaction(currentLines);
        if (parsed) transactions.push(parsed);
      }
      currentLines = [line];
      lastTrgLine = line;
      inTransaction = true;
    } else if (groupCode === '2TCG') {
      // 2TCG = Transaction Content Group. In SAFECO/Universal format, each 2TCG
      // represents a separate policy/insured within the same file.
      // Start a new sub-transaction, re-using the last 2TRG header.
      if (inTransaction && currentLines.length > 1) {
        // Close previous transaction
        const parsed = parseTransaction(currentLines);
        if (parsed) transactions.push(parsed);
        // Start new transaction with the same 2TRG header
        currentLines = lastTrgLine ? [lastTrgLine] : [];
      }
      // Don't add the 2TCG itself to lines — it's just a boundary marker
    } else if (groupCode === AL3_GROUP_CODES.MASTER_TRAILER) {
      if (inTransaction) {
        currentLines.push(line);
        const parsed = parseTransaction(currentLines);
        if (parsed) transactions.push(parsed);
        currentLines = [];
        inTransaction = false;
      }
    } else if (inTransaction) {
      currentLines.push(line);
    }
    // Lines outside transactions (1MHG headers, etc.) are skipped
  }

  // Handle unclosed transaction
  if (inTransaction && currentLines.length > 0) {
    const parsed = parseTransaction(currentLines);
    if (parsed) transactions.push(parsed);
  }

  return transactions;
}

/**
 * Parse a single transaction (group of lines between 2TRG and 3MTG).
 */
function parseTransaction(lines: string[]): AL3ParsedTransaction | null {
  if (lines.length === 0) return null;

  const headerLine = lines.find((l) => getGroupCode(l) === AL3_GROUP_CODES.TRANSACTION_HEADER);
  if (!headerLine) return null;

  const header = parseTransactionHeader(headerLine);
  const coverages: AL3Coverage[] = [];
  const vehicles: AL3Vehicle[] = [];
  const drivers: AL3Driver[] = [];
  const locations: AL3Location[] = [];
  const remarks: string[] = [];
  const claims: AL3Claim[] = [];
  const endorsementRecords: AL3Endorsement[] = [];
  const discountRecords: AL3Discount[] = [];

  let currentVehicle: AL3Vehicle | null = null;
  let confidence = 0.7; // Base confidence

  for (const line of lines) {
    const groupCode = getGroupCode(line);

    switch (groupCode) {
      case AL3_GROUP_CODES.COVERAGE: {
        const cov = parseCoverage(line);
        if (cov) {
          if (currentVehicle) {
            currentVehicle.coverages.push(cov);
          } else {
            coverages.push(cov);
          }
        }
        break;
      }

      case AL3_GROUP_CODES.VEHICLE: {
        // Save previous vehicle
        if (currentVehicle) vehicles.push(currentVehicle);
        currentVehicle = parseVehicle(line);
        break;
      }

      case AL3_GROUP_CODES.DRIVER: {
        const drv = parseDriver(line);
        if (drv) drivers.push(drv);
        break;
      }

      case AL3_GROUP_CODES.LOCATION: {
        const loc = parseLocation(line);
        if (loc) locations.push(loc);
        break;
      }

      case AL3_GROUP_CODES.REMARK: {
        const remark = line.substring(4).trim();
        if (remark) remarks.push(remark);
        break;
      }

      case AL3_GROUP_CODES.DISCOUNT: {
        const disc = parseDiscount(line);
        if (disc) discountRecords.push(disc);
        break;
      }

      case AL3_GROUP_CODES.CLAIM: {
        const clm = parseClaim(line);
        if (clm) claims.push(clm);
        break;
      }

      case AL3_GROUP_CODES.ENDORSEMENT: {
        const end = parseEndorsement(line);
        if (end) endorsementRecords.push(end);
        break;
      }

      case AL3_GROUP_CODES.PREMIUM: {
        // Try to extract total premium from premium record
        const premiumStr = line.substring(4).trim();
        const premium = parseAL3Number(premiumStr);
        if (premium && !header.policyNumber) {
          // Fallback premium extraction
        }
        break;
      }

      case AL3_GROUP_CODES.BUSINESS_INFO_SEGMENT: {
        // 5BIS contains insured name(s).
        // Two format variants:
        //   Progressive: pos 30=type prefix (P/C), 39-65=first name, 66-89=last name
        //   SAFECO/Universal: name at pos 18+ delimited by field separators (0xFA)
        // Strategy: try position-based first, then content-based regex fallback
        if (!header.insuredName && line.length > 20) {
          let nameResult: string | null = null;

          // Attempt 1: Position-based (Progressive format — pos 31-89)
          if (line.length > 39) {
            const nameArea = line.substring(31, 90)
              .replace(/[\x00-\x1F\x7F-\xFF]/g, ' ')
              .replace(/\?+/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            // Only accept if it looks like a real name: must have a word with 3+ letters,
            // no embedded record codes, not starting with digits
            let cleanName = nameArea.replace(/\d[A-Z]{3}\d{3}.*/, '').trim();
            // Strip trailing EDIFACT tag residue (e.g., "21 3C IN 14" — mixed hex codes and short words)
            cleanName = cleanName.replace(/\s+[0-9A-F]{2}(\s+\S{1,4})*\s*$/, '').trim();
            if (cleanName && cleanName.length > 3 && /[a-zA-Z]{3,}/.test(cleanName) && !/^\d/.test(cleanName) && !/^[a-z]\s\d/.test(cleanName)) {
              nameResult = cleanName;
            }
          }

          // Attempt 2: Content-based (SAFECO format — find name between control chars)
          if (!nameResult) {
            // Clean entire line, then find name-like content
            const printable = line
              .replace(/[\x00-\x1F\x7F-\xFF]/g, '\n')
              .split('\n')
              .map(s => s.trim())
              // Strip leading EDIFACT tag identifiers (e.g., "0E ", "21 ", "3C")
              .map(s => s.replace(/^[0-9A-F]{2}\s+/, ''))
              .filter(s => s.length > 2);
            // Find the first segment that looks like a person name (has letters, not a record code)
            for (const segment of printable) {
              // Skip segments that are record headers, codes, or numeric
              if (/^\d[A-Z]{3}/.test(segment)) continue;
              if (/^[A-Z]{3,4}\d{3}/.test(segment)) continue;
              if (/^\d+$/.test(segment)) continue;
              if (/^[A-Z]{1,2}\d{4,}/.test(segment)) continue;
              // Look for name-like content: starts with a letter, has 3+ chars
              const nameMatch = segment.match(/^[CP]?([A-Za-z][A-Za-z .'\-]+[A-Za-z])$/);
              if (nameMatch) {
                // Strip leading type prefix (C or P)
                let name = nameMatch[0];
                if (/^[CP][A-Z][a-z]/.test(name)) name = name.substring(1);
                nameResult = name.replace(/\s+/g, ' ').trim();
                break;
              }
            }
          }

          if (nameResult) {
            header.insuredName = nameResult;
          }
        }
        break;
      }

      case AL3_GROUP_CODES.COVERAGE_VEHICLE: {
        // 6CVA: vehicle-level coverage with premium and limit
        const cva = parse6LevelCoverage(line, 'vehicle');
        if (cva) {
          if (currentVehicle) {
            currentVehicle.coverages.push(cva);
          } else {
            coverages.push(cva);
          }
        }
        break;
      }

      case AL3_GROUP_CODES.COVERAGE_HOME: {
        // 6CVH: home coverage record (SAFECO)
        const cvh = parse6LevelCoverage(line, 'home');
        if (cvh) {
          coverages.push(cvh);
        }
        break;
      }

      case AL3_GROUP_CODES.FORM: {
        // 5FOR: form/endorsement schedule — extract as endorsement
        const form = parseForm(line);
        if (form) endorsementRecords.push(form);
        break;
      }

      case AL3_GROUP_CODES.BUSINESS_PURPOSE_INFO: {
        // 5BPI contains policy number and LOB
        // Format varies but policy number often appears after reference codes
        const bpiContent = line.substring(7);
        if (!header.policyNumber && bpiContent.length > 20) {
          // Look for policy number pattern: alphanumeric sequence (6+ chars)
          const policyMatch = bpiContent.match(/\b([A-Z]{1,3}\d{5,15})\b/);
          if (policyMatch) {
            header.policyNumber = policyMatch[1];
          } else {
            // Try to find any substantial alphanumeric code
            const altMatch = bpiContent.match(/\b(\d{7,15})\b/);
            if (altMatch) {
              header.policyNumber = altMatch[1];
            }
          }
        }
        // Extract LOB from 5BPI if not already set
        if (!header.lineOfBusiness) {
          const lobMatch = bpiContent.match(/\b(HOME|AUTO|PAUTO|CAUTO|PHOME)\b/i);
          if (lobMatch) {
            header.lineOfBusiness = LOB_CODES[lobMatch[1].toUpperCase()] || lobMatch[1];
          }
        }
        break;
      }
    }
  }

  // Save last vehicle
  if (currentVehicle) vehicles.push(currentVehicle);

  // Adjust confidence based on data completeness
  if (header.policyNumber && header.transactionType) confidence += 0.1;
  if (coverages.length > 0 || vehicles.length > 0) confidence += 0.1;
  if (header.effectiveDate) confidence += 0.05;
  confidence = Math.min(confidence, 1.0);

  return {
    header,
    coverages,
    vehicles,
    drivers,
    locations,
    remarks,
    claims,
    endorsementRecords,
    discountRecords,
    rawContent: lines.join('\n'),
    parseConfidence: confidence,
  };
}

/**
 * Parse a transaction header line (2TRG).
 * In IVANS AL3 format (212-byte records), the key fields are:
 *   167-169: transaction type (RWL, PCH, COM, etc.)
 *   204-211: effective date (YYYYMMDD)
 *   47-79:   carrier company name
 *   24-28:   LOB sub-code (PAUTO, PHOME, CAUTO)
 * Policy number and insured name are NOT in the 2TRG — they come from 5BPI/5BIS records.
 */
function parseTransactionHeader(line: string): AL3TransactionHeader {
  const transactionType = extractField(line, TRG_FIELDS.TRANSACTION_TYPE);
  const carrierCode = extractField(line, TRG_FIELDS.COMPANY_CODE);
  const carrierName = extractField(line, TRG_FIELDS.COMPANY_NAME);
  const effectiveDateRaw = extractField(line, TRG_FIELDS.EFFECTIVE_DATE);
  const lobCode = extractField(line, TRG_FIELDS.LOB_CODE);

  // Clean carrier name: strip trailing producer codes after long whitespace runs
  let cleanCarrierName = carrierName || '';
  const spaceRun = cleanCarrierName.match(/^(.+?)\s{3,}/);
  if (spaceRun) cleanCarrierName = spaceRun[1].trim();
  if (!cleanCarrierName || /^IBM/i.test(cleanCarrierName)) cleanCarrierName = '';

  // Fallback: try extracting LOB from anywhere in the first 40 chars if position-based failed
  let resolvedLob = LOB_CODES[lobCode] || lobCode || undefined;
  if (!resolvedLob || resolvedLob === lobCode) {
    const lobMatch = line.substring(0, 40).match(/\b(PHOME|PAUTO|CAUTO|HOME|AUTO)\b/i);
    if (lobMatch) resolvedLob = LOB_CODES[lobMatch[1].toUpperCase()] || lobMatch[1];
  }

  const header: AL3TransactionHeader = {
    transactionType: transactionType || 'UNKNOWN',
    policyNumber: '',
    carrierCode: carrierCode || '',
    carrierName: cleanCarrierName || undefined,
    lineOfBusiness: resolvedLob,
    effectiveDate: parseAL3Date(effectiveDateRaw),
    insuredName: undefined,
  };

  // Fallback: regex-based transaction type (for non-standard record formats or
  // EDIFACT-delimited formats where position-based extraction yields garbage)
  if (!transactionType || header.transactionType === 'UNKNOWN' || /^\d+$/.test(header.transactionType) || /[^\x20-\x7E]/.test(header.transactionType)) {
    const txMatch = line.match(/\b(RWL|RWQ|RNW|NBS|NBQ|END|ENQ|CAN|REI|AUD|INQ|PCH|COM)\b/);
    if (txMatch) header.transactionType = txMatch[1];
  }

  // Fallback: regex-based carrier name extraction
  // Trigger if name is missing, contains non-printable chars, or looks like a truncated fragment
  if (!header.carrierName || /[^\x20-\x7E]/.test(header.carrierName) || (header.carrierName.length < 20 && /^[A-Z]{3,}/.test(header.carrierName) === false)) {
    const cleanLine = line.replace(/[^\x20-\x7E]/g, ' ');
    const nameMatch = cleanLine.match(/([A-Z][A-Z &.']+(?:INS(?:URANCE)?|MUTUAL|ASSURANCE|INDEMNITY|CASUALTY|P&C|FIRE|GROUP|SURETY)[A-Z &.']*(?: CO| COMPANY| CORP)?)/i);
    if (nameMatch && nameMatch[1].length > (header.carrierName?.length || 0)) {
      // Clean up: if the name starts with a repeated carrier code, trim the prefix
      let name = nameMatch[1].trim();
      // Handle "UNIVUNIVERSAL" → "UNIVERSAL" pattern (carrier code prefix runs into name)
      const repeatMatch = name.match(/^([A-Z]{3,6})\1/i);
      if (repeatMatch) {
        name = name.substring(repeatMatch[1].length);
      }
      header.carrierName = name;
    }
  }

  // Fallback: extract effective date via regex if position-based failed
  if (!header.effectiveDate) {
    // Look for YYYYMMDD dates in the line (2025-2027 range)
    const cleanLine = line.replace(/[^\x20-\x7E]/g, '');
    const dateMatch = cleanLine.match(/(202[5-7][01]\d[0-3]\d)/g);
    if (dateMatch && dateMatch.length >= 1) {
      // Last date in the record is usually the effective date
      header.effectiveDate = parseAL3Date(dateMatch[dateMatch.length - 1]);
    }
  }

  return header;
}

/**
 * Parse a coverage record (5CVG).
 */
function parseCoverage(line: string): AL3Coverage | null {
  const code = extractField(line, CVG_FIELDS.COVERAGE_CODE);
  if (!code || code === 'PIF') return null; // PIF = Paid in Full, not a real coverage

  const limitStr = extractField(line, CVG_FIELDS.LIMIT);
  const deductibleStr = extractField(line, CVG_FIELDS.DEDUCTIBLE);

  return {
    code,
    description: code,
    limit: limitStr || undefined,
    limitAmount: parseAL3Number(limitStr),
    deductible: deductibleStr || undefined,
    deductibleAmount: parseAL3Number(deductibleStr),
    premium: undefined, // Premiums are in 6CVA records, not 5CVG
  };
}

/**
 * Parse a level-6 coverage record (6CVA or 6CVH).
 * 6CVA: vehicle-level coverage with premium at position 60 and limit at position 90.
 * 6CVH: home coverage with limit at position 60 and secondary amount at position 90.
 */
function parse6LevelCoverage(line: string, type: 'vehicle' | 'home'): AL3Coverage | null {
  const fields = type === 'vehicle' ? CVA_FIELDS : CVH_FIELDS;
  const code = extractField(line, fields.COVERAGE_CODE);
  if (!code || code === 'PIF') return null;

  if (type === 'vehicle') {
    // 6CVA: position 60 = premium (may have +/- suffix), position 90 = limit
    const premiumStr = extractField(line, CVA_FIELDS.PREMIUM).replace(/[+-]$/, '');
    const limitStr = extractField(line, CVA_FIELDS.LIMIT);
    const premium = parseAL3Number(premiumStr);
    const limitAmount = parseAL3Number(limitStr);

    // Skip discount-code-only records (no premium and no limit)
    if (!premium && !limitAmount) return null;

    return {
      code,
      description: code,
      limit: limitStr || undefined,
      limitAmount,
      deductible: undefined,
      deductibleAmount: undefined,
      premium: premium ? premium / 100 : undefined, // IVANS premiums are in cents
    };
  } else {
    // 6CVH: position 60 = primary limit, position 90 = secondary amount
    const limitStr = extractField(line, CVH_FIELDS.LIMIT);
    const secondaryStr = extractField(line, CVH_FIELDS.SECONDARY_AMOUNT);
    const limitAmount = parseAL3Number(limitStr);
    const secondaryAmount = parseAL3Number(secondaryStr);

    // Use primary limit if available, otherwise fall back to secondary
    const finalLimit = limitAmount || secondaryAmount;
    if (!finalLimit) return null;

    return {
      code,
      description: code,
      limit: (limitAmount ? limitStr : secondaryStr) || undefined,
      limitAmount: finalLimit,
      deductible: undefined,
      deductibleAmount: undefined,
      premium: undefined,
    };
  }
}

/**
 * Parse a form/endorsement schedule record (5FOR).
 */
function parseForm(line: string): AL3Endorsement | null {
  let formNumber = extractField(line, FOR_FIELDS.FORM_NUMBER);
  let description = extractField(line, FOR_FIELDS.DESCRIPTION);
  if (!formNumber && !description) return null;

  // Clean non-printable characters and ? filler
  if (formNumber) formNumber = formNumber.replace(/[^\x20-\x7E]/g, '').trim() || '';
  if (description) {
    description = description
      .replace(/[^\x20-\x7E]/g, ' ')  // Remove non-printable chars
      .replace(/\?{3,}/g, '')          // Strip runs of 3+ question marks (filler)
      .replace(/\s+/g, ' ')
      .trim() || '';
  }

  return {
    code: formNumber || 'FORM',
    description: description || formNumber || undefined,
    effectiveDate: undefined,
    premium: undefined,
  };
}

/**
 * Parse a vehicle record (5VEH).
 */
function parseVehicle(line: string): AL3Vehicle {
  let vin = extractField(line, VEH_FIELDS.VIN) || undefined;
  const year = parseAL3Number(extractField(line, VEH_FIELDS.YEAR)) as number | undefined;
  let make = extractField(line, VEH_FIELDS.MAKE) || undefined;
  let model = extractField(line, VEH_FIELDS.MODEL) || undefined;

  // Regex fallback for VIN if position-based extraction fails
  if (!vin || vin.length < 17) {
    const vinMatch = line.match(/[A-HJ-NPR-Z0-9]{17}/);
    if (vinMatch) vin = vinMatch[0];
  }

  // Clean up make/model (remove non-printable chars)
  if (make) make = make.replace(/[^\x20-\x7E]/g, '').trim() || undefined;
  if (model) model = model.replace(/[^\x20-\x7E]/g, '').trim() || undefined;

  return { vin, year, make, model, usage: undefined, coverages: [] };
}

/**
 * Parse a driver record (5DRV).
 * IVANS format has a complex name field with type prefix and split first/last names.
 */
function parseDriver(line: string): AL3Driver | null {
  // Extract raw name area (positions 39-97: first name + last name)
  let rawName = extractField(line, DRV_FIELDS.NAME);
  if (!rawName) return null;

  // Clean non-printable characters and collapse whitespace
  rawName = rawName.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!rawName) return null;

  // Parse DOB — try YYYYMMDD (positions 160-167) first, then YYMMDD (positions 140-145)
  let dateOfBirth: string | undefined;
  const dobFull = extractField(line, DRV_FIELDS.DOB_FULL);
  if (dobFull && /^\d{8}$/.test(dobFull)) {
    dateOfBirth = parseAL3Date(dobFull);
  } else {
    const dobRaw = extractField(line, DRV_FIELDS.DOB);
    if (dobRaw && /^\d{6}$/.test(dobRaw)) {
      const yy = parseInt(dobRaw.substring(0, 2), 10);
      const mm = dobRaw.substring(2, 4);
      const dd = dobRaw.substring(4, 6);
      const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
      dateOfBirth = parseAL3Date(`${yyyy}${mm}${dd}`);
    }
  }

  return {
    name: rawName,
    dateOfBirth,
    licenseNumber: extractField(line, DRV_FIELDS.LICENSE_NUMBER) || undefined,
    licenseState: extractField(line, DRV_FIELDS.LICENSE_STATE) || undefined,
    relationship: undefined,
  };
}

/**
 * Parse a location record (5LOC).
 */
function parseLocation(line: string): AL3Location | null {
  const content = line.substring(4).trim();
  if (!content) return null;

  // Location records vary significantly - attempt basic extraction
  return {
    address: content.substring(0, 60).trim() || undefined,
    city: content.substring(60, 90).trim() || undefined,
    state: content.substring(90, 92).trim() || undefined,
    zip: content.substring(92, 102).trim() || undefined,
  };
}

/**
 * Parse a discount record (5DSC).
 */
function parseDiscount(line: string): AL3Discount | null {
  const code = extractField(line, DSC_FIELDS.DISCOUNT_CODE);
  if (!code) return null;

  return {
    code,
    description: extractField(line, DSC_FIELDS.DESCRIPTION) || undefined,
    amount: parseAL3Number(extractField(line, DSC_FIELDS.AMOUNT)),
    percent: parseAL3Number(extractField(line, DSC_FIELDS.PERCENT)),
  };
}

/**
 * Parse a claim record (5CLM).
 */
function parseClaim(line: string): AL3Claim | null {
  const claimNumber = extractField(line, CLM_FIELDS.CLAIM_NUMBER);
  const claimType = extractField(line, CLM_FIELDS.CLAIM_TYPE);
  if (!claimNumber && !claimType) return null;

  return {
    claimNumber: claimNumber || undefined,
    claimDate: parseAL3Date(extractField(line, CLM_FIELDS.CLAIM_DATE)),
    claimType: claimType || undefined,
    amount: parseAL3Number(extractField(line, CLM_FIELDS.AMOUNT)),
    status: extractField(line, CLM_FIELDS.STATUS) || undefined,
  };
}

/**
 * Parse an endorsement record (5END).
 */
function parseEndorsement(line: string): AL3Endorsement | null {
  const code = extractField(line, END_FIELDS.ENDORSEMENT_CODE);
  if (!code) return null;

  return {
    code,
    description: extractField(line, END_FIELDS.DESCRIPTION) || undefined,
    effectiveDate: parseAL3Date(extractField(line, END_FIELDS.EFFECTIVE_DATE)),
    premium: parseAL3Number(extractField(line, END_FIELDS.PREMIUM)),
  };
}
