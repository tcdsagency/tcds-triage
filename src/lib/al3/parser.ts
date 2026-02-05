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
  AL3Mortgagee,
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
  BIS_FIELDS,
  BIS_ADDRESS_FIELDS,
  BIS_ADDRESS_FIELDS_SHORT,
  BPI_FIELDS,
  LAG_FIELDS,
  AOI_FIELDS,
  COM_FIELDS,
  RMK_FIELDS,
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
  const mortgagees: AL3Mortgagee[] = [];
  let insuredAddress: AL3Location | undefined;
  let insuredEmail: string | undefined;
  let insuredPhone: string | undefined;

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
        // Reference positions: 29=entity type, 38-62=first name, 63-87=last name
        // Two format variants:
        //   Standard: position-based extraction using BIS_FIELDS
        //   SAFECO/Universal: name at pos 18+ delimited by field separators (0xFA)
        // Strategy: try position-based first, then content-based regex fallback
        if (!header.insuredName && line.length > 20) {
          let nameResult: string | null = null;

          // Attempt 1: Position-based — try reference positions first, then wider range
          if (line.length > 63) {
            const entityType = extractField(line, BIS_FIELDS.ENTITY_TYPE);

            if (entityType === 'C' || entityType === 'G') {
              // Company/Group: name starts at 31 (right after entity type at 30)
              const companyName = line.substring(31, 88)
                .replace(/[\x00-\x1F\x7F-\xFF]/g, ' ')
                .replace(/\?+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              if (companyName && companyName.length > 2 && /[a-zA-Z]{2,}/.test(companyName)) {
                nameResult = companyName;
              }
            } else {
              // Person: read positions 39-98 as single name field (matches DRV approach)
              // then collapse whitespace to merge first + last name
              let rawName = line.substring(39, Math.min(line.length, 98))
                .replace(/[\x00-\x1F\x7F-\xFF]/g, ' ')
                .replace(/\?+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              // Clean trailing record artifacts
              rawName = rawName.replace(/\s+[0-9A-F]{2}(\s+\S{1,4})*\s*$/, '').trim();
              rawName = rawName.replace(/\d[A-Z]{3}\d{3}.*/, '').trim();

              if (rawName.length > 2 && /[a-zA-Z]{3,}/.test(rawName) && !/^\d/.test(rawName) && !/^[a-z]\s\d/.test(rawName)) {
                nameResult = rawName;
              }
            }
          }

          // Attempt 2: Content-based (SAFECO format — find name between control chars)
          if (!nameResult) {
            const printable = line
              .replace(/[\x00-\x1F\x7F-\xFF]/g, '\n')
              .split('\n')
              .map(s => s.trim())
              .map(s => s.replace(/^[0-9A-F]{2}\s+/, ''))
              .filter(s => s.length > 2);
            for (const segment of printable) {
              if (/^\d[A-Z]{3}/.test(segment)) continue;
              if (/^[A-Z]{3,4}\d{3}/.test(segment)) continue;
              if (/^\d+$/.test(segment)) continue;
              if (/^[A-Z]{1,2}\d{4,}/.test(segment)) continue;
              const nameMatch = segment.match(/^[CP]?([A-Za-z][A-Za-z .'\-]+[A-Za-z])$/);
              if (nameMatch) {
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
        // 5BPI: Policy number, dates, premium, LOB
        // Position-based extraction first, then regex fallback
        if (line.length > 49) {
          // Policy number at positions 24-48 (25 chars)
          if (!header.policyNumber) {
            let policyNum = extractField(line, BPI_FIELDS.POLICY_NUMBER)
              .replace(/\?+/g, '')
              .trim();
            // Strip leading reference prefix (e.g., "01    " or "F10001") before actual policy number
            policyNum = policyNum.replace(/^[A-Z]?\d{1,2}\s{2,}/, '').trim();
            if (policyNum && policyNum.length >= 5 && /[A-Z0-9]/.test(policyNum)) {
              header.policyNumber = policyNum;
            }
          }

          // LOB from BPI positions 64-68
          if (!header.lineOfBusiness && line.length > 69) {
            const bpiLob = extractField(line, BPI_FIELDS.LOB_CODE).replace(/\?+/g, '').trim();
            if (bpiLob && LOB_CODES[bpiLob]) {
              header.lineOfBusiness = LOB_CODES[bpiLob];
            }
          }

          // Effective date from BPI (YYMMDD at 73-78 or YYYYMMDD in extended portion)
          if (!header.effectiveDate && line.length > 79) {
            const effShort = extractField(line, BPI_FIELDS.EFF_DATE_SHORT);
            if (effShort && /^\d{6}$/.test(effShort)) {
              const yy = parseInt(effShort.substring(0, 2), 10);
              const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
              header.effectiveDate = parseAL3Date(`${yyyy}${effShort.substring(2)}`);
            }
          }

          // Expiration date from BPI (YYMMDD at 79-84)
          if (!header.expirationDate && line.length > 85) {
            const expShort = extractField(line, BPI_FIELDS.EXP_DATE_SHORT);
            if (expShort && /^\d{6}$/.test(expShort)) {
              const yy = parseInt(expShort.substring(0, 2), 10);
              const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
              header.expirationDate = parseAL3Date(`${yyyy}${expShort.substring(2)}`);
            }
          }
        }

        // Regex fallback for policy number
        if (!header.policyNumber) {
          const bpiContent = line.substring(7);
          const policyMatch = bpiContent.match(/\b([A-Z]{1,3}\d{5,15})\b/);
          if (policyMatch) {
            header.policyNumber = policyMatch[1];
          } else {
            const altMatch = bpiContent.match(/\b(\d{7,15})\b/);
            if (altMatch) header.policyNumber = altMatch[1];
          }
        }
        // Regex fallback for LOB
        if (!header.lineOfBusiness) {
          const lobMatch = line.match(/\b(HOME|AUTOP?|PAUTO|CAUTO|PHOME|FIRE|FLOOD|BOAT)\b/i);
          if (lobMatch) {
            header.lineOfBusiness = LOB_CODES[lobMatch[1].toUpperCase()] || lobMatch[1];
          }
        }
        break;
      }

      default: {
        // Handle record types by their 4-char group code prefix
        const gc = getGroupCode(line);

        if (gc === '9BIS' && !insuredAddress) {
          // 9BIS: Insured address continuation
          insuredAddress = parseBISAddress(line) ?? undefined;
          // Extract phone from 9BIS if available
          if (!insuredPhone && insuredAddress) {
            const fields = line.length > 130 ? BIS_ADDRESS_FIELDS : BIS_ADDRESS_FIELDS_SHORT;
            const phone = extractField(line, fields.PHONE).replace(/\?+/g, '').trim();
            if (phone && /^\d{7,}$/.test(phone)) {
              insuredPhone = phone;
            }
          }
        } else if (gc === '5AOI') {
          // 5AOI: Additional Other Insured (mortgagee/lienholder)
          const mortgagee = parseMortgagee(line);
          if (mortgagee) mortgagees.push(mortgagee);
        } else if (gc === '6COM') {
          // 6COM: Communication record (email, phone)
          const commType = extractField(line, COM_FIELDS.COMM_TYPE).toUpperCase();
          const commValue = extractField(line, COM_FIELDS.VALUE).replace(/\?+/g, '').trim();
          if (commType === 'EMAIL' && commValue && commValue.includes('@')) {
            insuredEmail = commValue.toLowerCase();
          } else if ((commType === 'PHONE' || commType === 'CELL') && commValue && /^\d{7,}$/.test(commValue)) {
            if (!insuredPhone) insuredPhone = commValue;
          }
        } else if (gc === '5RMK') {
          // 5RMK: Remarks — proper parsing + email extraction
          const remarkText = extractField(line, RMK_FIELDS.TEXT).replace(/\?+/g, ' ').replace(/\s+/g, ' ').trim();
          if (remarkText) {
            remarks.push(remarkText);
            // Extract email from remark text if not already found
            if (!insuredEmail) {
              const emailMatch = remarkText.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
              if (emailMatch) insuredEmail = emailMatch[0].toLowerCase();
            }
          }
        } else if (gc === '5LAG') {
          // 5LAG: Location Address Group — use proper reference positions
          const loc = parseLAGLocation(line);
          if (loc) locations.push(loc);
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
  if (insuredAddress) confidence += 0.05;
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
    mortgagees,
    insuredAddress,
    insuredEmail,
    insuredPhone,
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
    // 6CVA: premium at 60 (implied 2 decimals + sign), limits at 102+, deductible at 122+
    const premiumStr = extractField(line, CVA_FIELDS.PREMIUM).replace(/[+-]$/, '');
    const limitStr = extractField(line, CVA_FIELDS.LIMIT);
    const limit2Str = extractField(line, CVA_FIELDS.LIMIT_2);
    const deductibleStr = extractField(line, CVA_FIELDS.DEDUCTIBLE);
    const descriptionStr = line.length > 145 ? extractField(line, CVA_FIELDS.DESCRIPTION) : '';
    const premium = parseAL3Number(premiumStr);
    const limitAmount = parseAL3Number(limitStr);
    const deductibleAmount = parseAL3Number(deductibleStr);

    // Skip discount-code-only records (no premium, no limit, no deductible)
    if (!premium && !limitAmount && !deductibleAmount) return null;

    // Build limit display string for split limits (BI, UM, UMBI)
    // Format: Limit 1 (10 chars) = [7 digits per-person][3 digits per-accident prefix]
    // Limit 2 (5+ chars) = per-accident suffix
    // Example: "0100000003" + "00000" → $100,000/$300,000
    let displayLimit = limitStr || undefined;
    const splitLimitCodes = ['BI', 'UM', 'UMBI', 'UMISP', 'UIM'];
    const isSplitLimit = splitLimitCodes.includes(code.toUpperCase());
    if (isSplitLimit && limitStr && limitStr.length >= 7) {
      const rawLimit = limitStr.replace(/[^0-9]/g, '');
      if (rawLimit.length >= 7) {
        const perPerson = parseInt(rawLimit.substring(0, 7), 10);
        const perAccidentPrefix = rawLimit.substring(7);
        const rawLimit2 = (limit2Str || '').replace(/[^0-9]/g, '');
        const perAccident = parseInt(perAccidentPrefix + rawLimit2, 10);
        if (perPerson > 0) {
          displayLimit = perAccident > 0 ? `${perPerson}/${perAccident}` : `${perPerson}`;
        }
      }
    }

    // Use human-readable description from 6CVA if available
    const cleanDesc = descriptionStr
      ?.replace(/[\x00-\x1F\x7F-\xFF]/g, ' ')
      .replace(/\?+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      code,
      description: cleanDesc || code,
      limit: displayLimit,
      limitAmount,
      deductible: deductibleStr || undefined,
      deductibleAmount,
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
 * Parse a location record (5LOC) — generic fallback.
 */
function parseLocation(line: string): AL3Location | null {
  const content = line.substring(4).trim();
  if (!content) return null;

  return {
    address: content.substring(0, 60).trim() || undefined,
    city: content.substring(60, 90).trim() || undefined,
    state: content.substring(90, 92).trim() || undefined,
    zip: content.substring(92, 102).trim() || undefined,
  };
}

/**
 * Parse a 5LAG location address record using reference field positions.
 */
function parseLAGLocation(line: string): AL3Location | null {
  if (line.length < 110) return null;

  // LAG has a location number at 24-28, but Progressive offsets may push data forward
  // Read both number and address; if address starts with digits, it might be the number
  let locNumber = extractField(line, LAG_FIELDS.LOCATION_NUMBER).replace(/\?+/g, '').trim();
  let address = extractField(line, LAG_FIELDS.ADDRESS)
    .replace(/\?+/g, ' ').replace(/\s+/g, ' ').trim();

  // If location number ran into address, extract it
  if (!locNumber && address) {
    const numMatch = address.match(/^(\d{4})(.*)/);
    if (numMatch) {
      locNumber = numMatch[1];
      address = numMatch[2].trim();
    }
  }

  const city = extractField(line, LAG_FIELDS.CITY)
    .replace(/^\?+/, '').replace(/\?+/g, ' ').trim();
  const state = extractField(line, LAG_FIELDS.STATE).replace(/\?+/g, '').trim();
  const zip = extractField(line, LAG_FIELDS.ZIP).replace(/\?+/g, '').trim();

  if (!address && !city) return null;

  return {
    number: locNumber || undefined,
    address: address || undefined,
    city: city || undefined,
    state: (state && state.length === 2) ? state : undefined,
    zip: (zip && /^\d{5}/.test(zip)) ? zip.substring(0, 5) : undefined,
  };
}

/**
 * Parse a 9BIS insured address continuation record.
 * Two variants: long (343 bytes) and short (168 bytes, Safeco).
 */
function parseBISAddress(line: string): AL3Location | null {
  if (line.length < 100) return null;

  // Use short fields for shorter records (Safeco 168-byte variant)
  const fields = line.length > 200 ? BIS_ADDRESS_FIELDS : BIS_ADDRESS_FIELDS_SHORT;

  const address = extractField(line, fields.ADDRESS_1)
    .replace(/\?+/g, ' ').replace(/\s+/g, ' ').trim();

  let city: string;
  if ('CITY' in fields) {
    city = extractField(line, fields.CITY)
      .replace(/^\?+/, '').replace(/\?+/g, ' ').trim();
  } else {
    city = '';
  }

  const state = extractField(line, fields.STATE).replace(/\?+/g, '').trim();
  const zip = extractField(line, fields.ZIP).replace(/\?+/g, '').trim();

  if (!address && !city && !state) return null;

  return {
    address: address || undefined,
    city: city || undefined,
    state: (state && state.length === 2) ? state : undefined,
    zip: (zip && /^\d{5}/.test(zip)) ? zip.substring(0, 5) : undefined,
  };
}

/**
 * Parse a 5AOI mortgagee/lienholder record.
 */
function parseMortgagee(line: string): AL3Mortgagee | null {
  if (line.length < 72) return null;

  let interestType = extractField(line, AOI_FIELDS.INTEREST_TYPE).replace(/\?+/g, '').trim();
  let rawName = extractField(line, AOI_FIELDS.NAME)
    .replace(/[\x00-\x1F\x7F-\xFF]/g, ' ')
    .replace(/\?+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!rawName) return null;

  // Strip prefix residue: sequence + interest type + entity type that bleeds into name field
  // Pattern: "1LH01 CFord Motor Credit" → extract interest type from prefix, then strip it
  const prefixMatch = rawName.match(/^(\d+)([A-Z]{2})(\d+)\s*([CP])(.*)/);
  if (prefixMatch) {
    if (!interestType) interestType = prefixMatch[2]; // LH, MS, CN, etc.
    rawName = prefixMatch[5].trim();
  }

  if (!rawName) return null;

  let loanNumber: string | undefined;
  if (line.length > 141) {
    loanNumber = extractField(line, AOI_FIELDS.LOAN_NUMBER).replace(/\?+/g, '').trim() || undefined;
  }

  return {
    interestType: interestType || undefined,
    name: rawName,
    loanNumber,
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
