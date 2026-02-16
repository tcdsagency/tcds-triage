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
  COVERAGE_CODE_MAP,
  DISCOUNT_COVERAGE_TYPES,
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
 * Parse a limit string that may contain split limits (e.g., "250,000/500,000"
 * for per-person/per-accident, or "50/1,500" for per-day/per-occurrence).
 * Returns the numeric value of the first (per-person) part only to enable
 * consistent comparison between HawkSoft and AL3 data.
 */
export function parseSplitLimit(str: string): number | undefined {
  if (!str) return undefined;
  const trimmed = str.trim();
  // Split on "/" and take the first part
  const firstPart = trimmed.split('/')[0];
  const cleaned = firstPart.replace(/[^0-9.-]/g, '');
  if (!cleaned) return undefined;
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

// =============================================================================
// UNIVERSAL PATTERN EXTRACTION
// =============================================================================

/**
 * Pattern definitions for universal data extraction.
 * These patterns identify data types regardless of field position.
 */
const EXTRACTION_PATTERNS = {
  // Numeric patterns
  LIMIT_8DIGIT: /\b(\d{8})\b/g,              // 8-digit zero-padded limit (e.g., 00300000)
  LIMIT_7DIGIT: /\b(0\d{6})\b/g,             // 7-digit with leading zero
  DEDUCTIBLE: /\b(\d{4,7})\b/g,              // 4-7 digit deductibles
  PREMIUM_SIGNED: /(\d{8,12}[+-])/g,         // Premium with trailing sign (cents)
  PREMIUM_PLAIN: /\b(\d{6,10})\b/g,          // Plain premium amount

  // Date patterns
  DATE_YYYYMMDD: /\b(20[2-3]\d[01]\d[0-3]\d)\b/g,  // 2020-2039 dates

  // Identifier patterns
  VIN: /\b([A-HJ-NPR-Z0-9]{17})\b/g,         // 17-char VIN (no I, O, Q)
  POLICY_NUMBER: /\b([A-Z0-9]{6,15})\b/g,    // Policy number patterns
  COVERAGE_CODE: /\b([A-Z]{2,6}[0-9]{0,2})\b/g,  // Coverage codes like BI, PD, COMP, MIN01

  // Text patterns
  DESCRIPTION: /([A-Z][a-z]+(?:\s+[A-Za-z]+)*)/g,  // Title case descriptions
  NAME: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,       // Full names (First Last)
};

/**
 * Extract all matches of a pattern from text after a given start position.
 */
function extractPatternMatches(
  text: string,
  pattern: RegExp,
  startPos: number = 0
): Array<{ value: string; position: number }> {
  const results: Array<{ value: string; position: number }> = [];
  const section = text.substring(startPos);
  const regex = new RegExp(pattern.source, pattern.flags);
  let match;
  while ((match = regex.exec(section)) !== null) {
    results.push({
      value: match[1] || match[0],
      position: startPos + match.index,
    });
  }
  return results;
}

/**
 * Universal coverage data extractor.
 * Tries fixed positions first, falls back to pattern matching.
 */
interface ExtractedCoverageData {
  code?: string;
  description?: string;
  limitAmount?: number;
  limitStr?: string;
  deductibleAmount?: number;
  deductibleStr?: string;
  premium?: number;
}

function extractCoverageDataUniversal(
  line: string,
  codeStartPos: number = 30,
  codeEndPos: number = 45
): ExtractedCoverageData {
  const result: ExtractedCoverageData = {};

  // 1. Coverage code - usually reliable at fixed position
  const codeSection = line.substring(codeStartPos, codeEndPos).trim();
  const codeMatch = codeSection.match(/^([A-Z0-9_]+)/);
  result.code = codeMatch ? codeMatch[1] : undefined;

  // 2. Extract data from the remainder of the line (after code position)
  const dataSection = line.substring(codeEndPos);

  // 3. Find limit - look for 8-digit zero-padded numbers
  const eightDigitMatches = extractPatternMatches(dataSection, /(\d{8})/g, 0);
  if (eightDigitMatches.length > 0) {
    const rawLimit = eightDigitMatches[0].value;
    const parsed = parseInt(rawLimit.replace(/^0+/, '') || '0', 10);
    if (parsed > 0) {
      result.limitAmount = parsed;
      result.limitStr = String(parsed);
    }

    // Check for deductible immediately after limit
    const limitEndPos = eightDigitMatches[0].position + 8;
    const afterLimit = dataSection.substring(limitEndPos, limitEndPos + 10);
    const dedMatch = afterLimit.match(/^(\d{4,7})/);
    if (dedMatch) {
      const parsedDed = parseInt(dedMatch[1].replace(/^0+/, '') || '0', 10);
      if (parsedDed > 0 && parsedDed <= 25000) {
        result.deductibleAmount = parsedDed;
        result.deductibleStr = String(parsedDed);
      }
    }
  }

  // 4. Find premium - look for signed amounts (digits + +/-)
  const premiumMatches = extractPatternMatches(dataSection, /(\d{6,12})[+-]/g, 0);
  if (premiumMatches.length > 0) {
    const rawPremium = premiumMatches[0].value;
    const parsed = parseInt(rawPremium, 10);
    if (parsed > 0) {
      result.premium = parsed / 100; // AL3 premiums are in cents
    }
  }

  // 5. Find description - look for title case text at end of line
  const descMatches = extractPatternMatches(line.substring(100), /([A-Z][a-zA-Z]+(?:\s*[A-Za-z]+)*)/g, 0);
  if (descMatches.length > 0) {
    // Use the longest match as the description
    const longest = descMatches.reduce((a, b) => a.value.length > b.value.length ? a : b);
    if (longest.value.length > 3) {
      result.description = longest.value.trim();
    }
  }

  return result;
}

// =============================================================================
// FIELD EXTRACTION
// =============================================================================

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
 * Check if a record line uses EDIFACT-style 0xFA field separators (Allstate format).
 * Only checks after position 28 (past the standard AL3 header area).
 */
function isEDIFACTFormat(line: string): boolean {
  for (let i = 28; i < line.length; i++) {
    if (line.charCodeAt(i) === 0xFA) return true;
  }
  return false;
}

/**
 * Parse EDIFACT-style segments from a record line split on 0xFA bytes.
 * Allstate format: after each 0xFA, segments have a 2-char hex tag, optional space, then data.
 * Segments may contain embedded sub-records (e.g., multiple 6CVH records packed together).
 * Truncates segment data at embedded record boundaries.
 * Returns an array of { tag, data } where:
 *   - First segment (before first 0xFA) is tagged 'REF'
 *   - Subsequent segments: strip 2-char hex tag + optional space, clean non-printable/filler chars
 */
function parseEDIFACTSegments(line: string): { tag: string; data: string }[] {
  const segments: { tag: string; data: string }[] = [];
  // Split on 0xFA
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < line.length; i++) {
    if (line.charCodeAt(i) === 0xFA) {
      parts.push(line.substring(start, i));
      start = i + 1;
    }
  }
  parts.push(line.substring(start));

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === 0) {
      // First segment is the header/reference area — clean and tag as REF
      const cleaned = part.replace(/[\x00-\x1F\x7F-\xFF]/g, '').trim();
      segments.push({ tag: 'REF', data: cleaned });
    } else {
      // Clean non-printable chars
      let data = part.replace(/[\x00-\x1F\x7F-\xFF]/g, '');

      // Truncate at embedded record boundaries: "?<digit><3 uppercase><3 digits>"
      // When found, extract the embedded header as a separate SUB segment so it isn't lost.
      // E.g., "71?6CVH292 8 W100016HRUR10001    DWELL" → truncate to "71", push "6CVH292..." as SUB
      const boundaryMatch = data.match(/\?\d[A-Z]{3}\d{3}/);
      if (boundaryMatch && boundaryMatch.index !== undefined) {
        const embeddedHeader = data.substring(boundaryMatch.index + 1); // skip the "?"
        data = data.substring(0, boundaryMatch.index);
        // Push the embedded header as a SUB if it looks like a record header
        if (/^\d[A-Z]{3}\d{3}/.test(embeddedHeader)) {
          // Process current data first (below), then add the SUB
          const currentTagMatch = data.match(/^([0-9A-Fa-f]{2})\s?(.*)/);
          let currentTag = '';
          let currentData = data;
          if (currentTagMatch) {
            currentTag = currentTagMatch[1].toUpperCase();
            currentData = currentTagMatch[2].replace(/\?+/g, '').trim();
          }
          if (currentData) {
            segments.push({ tag: currentTag, data: currentData });
          }
          segments.push({ tag: 'SUB', data: embeddedHeader });
          continue;
        }
      }

      // Check if the FULL data (before hex tag strip) is an embedded sub-record header.
      // Headers like "6CVH292..." or "6FRU144..." start with chars that look like hex tags
      // (e.g., "6C", "6F") — must detect them BEFORE stripping, or the header is destroyed.
      if (/^\d[A-Z]{3}\d{3}/.test(data)) {
        segments.push({ tag: 'SUB', data });
        continue;
      }

      // Strip 2-char hex tag at start (e.g., "0E ", "08 ", "1E ")
      const tagMatch = data.match(/^([0-9A-Fa-f]{2})\s?(.*)/);
      let tag = '';
      if (tagMatch) {
        tag = tagMatch[1].toUpperCase();
        data = tagMatch[2];
      }

      // Check if the remaining data IS an embedded record header (after tag strip)
      if (/^\d[A-Z]{3}\d{3}/.test(data)) {
        // Mark as embedded sub-record header (used by parseEDIFACTSubRecords)
        segments.push({ tag: 'SUB', data });
        continue;
      }

      // Clean filler characters (? runs)
      data = data.replace(/\?+/g, '').trim();

      if (data) {
        segments.push({ tag, data });
      }
    }
  }

  return segments;
}

/**
 * Parse multiple EDIFACT sub-records from a single record line.
 * Allstate packs multiple records into one line separated by group code patterns in segments.
 * Returns array of { groupCode, coverageCode, segments } for each sub-record found.
 */
function parseEDIFACTSubRecords(line: string): { groupCode: string; coverageCode: string; segments: { tag: string; data: string }[] }[] {
  const allSegments = parseEDIFACTSegments(line);
  const subRecords: { groupCode: string; coverageCode: string; segments: { tag: string; data: string }[] }[] = [];

  // The REF segment contains the first record's group code and coverage code
  // Pattern: "6CVH292 8 W100026HRUR10001    MEDPM"
  // After that, segments may contain new record headers in their data
  let currentGroupCode = '';
  let currentCoverageCode = '';
  let currentSegments: { tag: string; data: string }[] = [];

  for (const seg of allSegments) {
    if (seg.tag === 'REF' || seg.tag === 'SUB') {
      // Extract group code and coverage code from REF or SUB (embedded sub-record) header
      // Pattern: "6CVH292 8 W100026HRUR10001    MEDPM"
      const headerMatch = seg.data.match(/^(\d[A-Z]{3})\d{3}\s.*?\s{2,}(\S+)\s*$/);
      if (headerMatch) {
        // Save previous sub-record if it has data
        if (currentGroupCode && (currentSegments.length > 0 || seg.tag === 'SUB')) {
          if (currentSegments.length > 0) {
            subRecords.push({ groupCode: currentGroupCode, coverageCode: currentCoverageCode, segments: currentSegments });
          }
        }
        currentGroupCode = headerMatch[1];
        currentCoverageCode = headerMatch[2];
        currentSegments = [];
      }
      continue;
    }

    currentSegments.push(seg);
  }

  // Save last sub-record
  if (currentGroupCode && currentSegments.length > 0) {
    subRecords.push({ groupCode: currentGroupCode, coverageCode: currentCoverageCode, segments: currentSegments });
  }

  return subRecords;
}

/**
 * Parse Allstate premium format: digits with trailing +/- sign, value in cents.
 * E.g., "0272689+" → 2726.89, "0005000-" → -50.00
 */
function parseAllstatePremium(str: string): number | undefined {
  const match = str.match(/^0*(\d+)([+-])?$/);
  if (!match) return undefined;
  const cents = parseInt(match[1], 10);
  if (isNaN(cents) || cents === 0) return undefined;
  const value = cents / 100;
  return match[2] === '-' ? -value : value;
}

/**
 * Parse all EDIFACT-format coverages from a 6CVH or 6CVA record line.
 * Allstate packs multiple coverage sub-records into a single line.
 * Each sub-record has: coverage code in header, premium (digits+sign), limit (long digits), description (text).
 */
function parseEDIFACTHomeCoverages(line: string): AL3Coverage[] {
  const subRecords = parseEDIFACTSubRecords(line);
  const results: AL3Coverage[] = [];

  for (const sub of subRecords) {
    // Only process coverage records (6CVH, 6CVA), skip other embedded record types
    if (sub.groupCode !== '6CVH' && sub.groupCode !== '6CVA') continue;
    const code = sub.coverageCode;
    if (!code) continue;

    // Skip sub-records that contain embedded transaction data (2TRG/2TCG/5BIS headers
    // leaked into coverage segments). These produce garbage coverages like "ACCT" with
    // descriptions that are insured names.
    const hasEmbeddedTxData = sub.segments.some(s =>
      /2TRG\d{3}/.test(s.data) || /2TCG\d{3}/.test(s.data) ||
      /5BIS\d{3}/.test(s.data)
    );
    if (hasEmbeddedTxData) continue;

    let premium: number | undefined;
    let limitAmount: number | undefined;
    let limitStr: string | undefined;
    let deductibleAmount: number | undefined;
    let deductibleStr: string | undefined;
    let description: string | undefined;

    for (const seg of sub.segments) {
      const d = seg.data;
      const t = seg.tag.toUpperCase();

      // Skip known date/non-coverage tags (e.g., tag "28" = effective/expiration dates,
      // tag "33" = date fragments). These should never be treated as limits or deductibles.
      if (t === '28' || t === '33') continue;

      // Premium: digits with trailing +/- (Allstate cents format)
      if (premium === undefined && /^\d{4,}[+-]$/.test(d)) {
        premium = parseAllstatePremium(d);
        continue;
      }

      // Limit: tag "1E" with digit-only data (leading zeros, e.g., "00025000")
      // Standard format: 8 zero-padded digits. Compound: >8 digits = limit(8) + extra.
      // Short values (<8 digits) occur when records are truncated at field boundaries —
      // right-pad with zeros to 8 digits (e.g., "0065" → "00650000" → 650,000).
      if (limitAmount === undefined && t === '1E' && /^0{1,}\d+$/.test(d) && d.length >= 3) {
        let limitPortion = d;
        if (limitPortion.length > 8) {
          limitPortion = limitPortion.substring(0, 8);
        } else if (limitPortion.length < 8) {
          limitPortion = limitPortion.padEnd(8, '0');
        }
        const cleaned = limitPortion.replace(/^0+/, '') || '0';
        limitAmount = parseInt(cleaned, 10);
        limitStr = limitPortion;
        continue;
      }

      // Deductible: tag "2E" with zero-padded digits (NatGen/Integon EDIFACT format)
      // Tag "2E" contains the deductible value, NOT the limit. Must check before fallback limit.
      if (deductibleAmount === undefined && t === '2E' && /^0{2,}\d{3,}$/.test(d) && d.length <= 8) {
        const cleaned = d.replace(/^0+/, '') || '0';
        const val = parseInt(cleaned, 10);
        if (val > 0) {
          deductibleAmount = val;
          deductibleStr = d;
        }
        continue;
      }

      // Fallback limit: any segment with leading-zero digits if tag 1E wasn't found
      // Exclude tag "2E" which is a deductible tag (handled above)
      if (limitAmount === undefined && t !== '2E' && /^0{2,}\d{4,}$/.test(d) && d.length <= 10) {
        const cleaned = d.replace(/^0+/, '') || '0';
        limitAmount = parseInt(cleaned, 10);
        limitStr = d;
        continue;
      }

      // Deductible: shorter numeric segment after limit is found
      // Exclude date-like values (YYYYMMDD or truncated dates like 202602)
      // For split-limit coverages (BI, UM), the next number after limit is per-accident limit, not deductible
      if (deductibleAmount === undefined && limitAmount !== undefined && /^\d{4,8}$/.test(d)) {
        const val = parseInt(d, 10);
        // Filter out values that look like dates (20YYMMDD range, including 6-digit truncated)
        const isDateLike = /^20[2-3]\d[01]\d[0-3]?\d?$/.test(d) && d.length >= 6;
        // For split-limit types (BI, UM), second numeric value is per-accident limit, not deductible
        const splitTypes = new Set(['BI', 'UM', 'UMBI', 'UMISP', 'UIM']);
        const isSplitLimitType = splitTypes.has(code.toUpperCase());
        if (isSplitLimitType && val > 0 && !limitStr?.includes('/')) {
          // Treat as per-accident portion of split limit
          limitStr = `${limitAmount}/${val}`;
          // limitAmount stays as per-person for numeric comparison
          continue;
        }
        if (val > 0 && val !== limitAmount && !isDateLike) {
          deductibleAmount = val;
          deductibleStr = d;
        }
        continue;
      }

      // Description: text with 3+ alpha chars, prefer lowercase text (human-readable)
      // Skip embedded transaction references (e.g., "3P PHOME FMGBN0 PL DOWN   ALLSTATE")
      if (!description && /[a-zA-Z]{3,}/.test(d) && !/^\d+[+-]?$/.test(d) && !/^0{2,}\d/.test(d)) {
        if (/^[0-9][A-Z]\s/.test(d)) continue; // Embedded reference (e.g., "3P PHOME...")
        if (/^[A-Z]\d{5,}/.test(d)) continue; // Policy/reference number
        if (/[a-z]/.test(d) || d.length > 5) {
          description = d;
        }
        continue;
      }
    }

    results.push({
      code,
      description: description || code,
      limit: limitStr || undefined,
      limitAmount,
      deductible: deductibleStr || undefined,
      deductibleAmount,
      premium,
    });
  }

  return results;
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
      // Include the 2TCG in the new transaction's lines — it contains insured name
      // and address data in EDIFACT format that supplements the 5BIS record.
      currentLines.push(line);
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
  let totalPremium: number | undefined;

  let currentVehicle: AL3Vehicle | null = null;
  let confidence = 0.7; // Base confidence

  // Allstate EDIFACT: track when we enter an auto section within a home transaction.
  // Auto sections start with 5ISI followed by 5PPH/6PDR/6PDA and contain 6CVA records.
  // These auto coverages should be excluded from homeowners transactions.
  let inAutoSection = false;
  let hasHomeCoverages = false;
  let seenHomeRecord = false; // Tracks whether we've encountered a home record in the main loop
  // First pass: check if this transaction has any 6CVH (home) records.
  // Also check for 6CVH sub-records embedded inside 6HRU/5REP lines.
  for (const line of lines) {
    const gc = getGroupCode(line);
    if (gc === '6CVH') { hasHomeCoverages = true; break; }
    if ((gc === '6HRU' || gc === '6FRU' || gc === '5REP') && line.includes('6CVH')) {
      hasHomeCoverages = true; break;
    }
  }

  for (const line of lines) {
    const groupCode = getGroupCode(line);

    // Allstate EDIFACT auto section detection: 5ISI followed by auto-specific records
    // marks the start of an auto section within a home transaction.
    // 9BIS or 5BPI with HOME LOB resets back to home section.
    if (hasHomeCoverages) {
      // Track when we've seen a home-specific record (6CVH, 6HRU, 6FRU, 5REP with coverages)
      if (groupCode === '6CVH' || ((groupCode === '6HRU' || groupCode === '6FRU' || groupCode === '5REP') && line.includes('6CVH'))) {
        seenHomeRecord = true;
      }

      if (groupCode === '5ISI') {
        // 5ISI can appear at the start (before home coverages) — only mark as auto
        // when it appears AFTER home-specific records have been seen
        if (seenHomeRecord) {
          inAutoSection = true;
        }
      } else if (groupCode === '5PPH' || groupCode === '6PDR' || groupCode === '6PDA') {
        // Auto-specific record types confirm we're in auto section
        if (inAutoSection) { /* stay in auto section */ }
      } else if (groupCode === '6CVH') {
        // Home coverage records always reset to home section
        inAutoSection = false;
      } else if (groupCode === '9BIS') {
        // 9BIS resets to home UNLESS it contains auto LOB indicators
        // (Allstate embeds auto 9BIS with AUTOP/PAUTO in bundled transactions)
        if (!line.includes('PAUTO') && !line.includes('AUTOP')) {
          inAutoSection = false;
        }
      }

      // Detect embedded auto section markers (Allstate EDIFACT packs 2TRG/5ISI within other lines)
      // An embedded 2TRG or 9BIS with auto LOB (PAUTO/AUTOP) signals the start of auto records
      if (seenHomeRecord && !inAutoSection) {
        if ((groupCode !== '2TRG' && line.includes('2TRG') && (line.includes('PAUTO') || line.includes('AUTOP'))) ||
            (groupCode === '9BIS' && (line.includes('PAUTO') || line.includes('AUTOP')))) {
          inAutoSection = true;
        }
      }
    }

    // Skip auto-specific records when in a home transaction's auto section
    if (hasHomeCoverages && inAutoSection) {
      const gc = getGroupCode(line);
      if (gc === '6CVA' || gc === '5PPH' || gc === '6PDR' || gc === '6PDA' ||
          gc === '6PVH' || gc === '5DRV' || gc === '5VEH' || gc === '5BPI') {
        continue; // Skip auto records in home transactions
      }
      // Also skip 5AOI/9AOI in auto section (auto lienholder, not home mortgagee)
      if (gc === '5AOI' || gc === '9AOI') {
        continue;
      }
    }

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

      case AL3_GROUP_CODES.SUPPLEMENTARY_DRIVER: {
        // 6SDV: Commercial supplementary driver record
        // Format: 6SDV256 D ... 0001????P        FIRSTNAME                  LASTNAME                DOB
        const drv = parseSupplementaryDriver(line);
        if (drv) drivers.push(drv);
        break;
      }

      case AL3_GROUP_CODES.COMMERCIAL_VEHICLE: {
        // 5CAR: Commercial auto vehicle record
        // Save previous vehicle
        if (currentVehicle) vehicles.push(currentVehicle);
        currentVehicle = parseCommercialVehicle(line);
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

          // Attempt 0: EDIFACT (Allstate) — parse 0xFA-delimited segments for name
          if (isEDIFACTFormat(line)) {
            const segments = parseEDIFACTSegments(line);
            // Skip REF, skip entity type (single char like "P" or "C"),
            // then collect consecutive alpha name parts (first, middle, last)
            const nameParts: string[] = [];
            let pastEntityType = false;
            for (const seg of segments) {
              if (seg.tag === 'REF') continue;
              // Entity type is a single char (P, C, G)
              if (!pastEntityType && /^[PCGIN]$/.test(seg.data)) {
                pastEntityType = true;
                continue;
              }
              pastEntityType = true;
              // Stop at non-name segments: numeric, codes, addresses, embedded records
              if (/^\d+[+-]?$/.test(seg.data)) break;
              if (/^[A-Z]{1,2}\d{4,}/.test(seg.data)) break;
              if (/\d/.test(seg.data) && /[a-zA-Z]/.test(seg.data)) break; // address
              // Name part: alphabetic text
              if (/^[A-Za-z][A-Za-z .'\-]*$/.test(seg.data)) {
                // Skip known non-name codes (2 char entity/status codes)
                if (/^(IN|FL|OUT|SEP|HOS|POT)$/i.test(seg.data)) break;
                nameParts.push(seg.data.trim());
              } else if (seg.data.length === 0) {
                // Empty segment (e.g., suffix) — skip but don't break
                continue;
              } else {
                break; // Non-name segment reached
              }
            }
            if (nameParts.length > 0) {
              let name = nameParts.filter(p => p.length > 0).join(' ').replace(/\s+/g, ' ').trim();
              // Strip leading entity type char if attached to first name part (e.g., "CHelen" → "Helen")
              if (/^[PCGIRFN][A-Z][a-z]/.test(name)) {
                name = name.substring(1);
              }
              // Also handle "R P FirstName" pattern (separate entity type chars)
              name = name.replace(/^[PCGIRFN]\s+[PCGIRFN]\s+/i, '').trim();
              if (name.length > 2) nameResult = name;
            }
          }

          // Attempt 1: Position-based — try reference positions first, then wider range
          if (!nameResult && line.length > 63) {
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

        // For EDIFACT format: also extract address and embedded policy data from 5BIS
        // (outside the name guard so address is always extracted even if name came from 2TCG)
        if (isEDIFACTFormat(line)) {
          if (!insuredAddress) {
            const addrResult = parseAllstateAddress(line);
            if (addrResult) {
              insuredAddress = addrResult.location;
              if (!insuredPhone && addrResult.phone) insuredPhone = addrResult.phone;
            }
          }
          // Extract policy number from embedded 5BPI data within 5BIS/5ISI
          // Pattern: "5BPI...<spaces>POLICYNUMBER"
          if (!header.policyNumber) {
            const cleanLine = line.replace(/[\x00-\x1F\x7F-\xFF]/g, ' ');
            const policyMatch = cleanLine.match(/5BPI\d{3}[^]*?\s{2,}(\d[\d-]{5,15}\d)\b/);
            if (policyMatch) header.policyNumber = policyMatch[1];
          }
          // Extract LOB and dates from embedded 5BPI data
          if (!header.lineOfBusiness || !header.effectiveDate) {
            const cleanLine = line.replace(/[\x00-\x1F\x7F-\xFF]/g, ' ');
            if (!header.lineOfBusiness) {
              const lobMatch = cleanLine.match(/\b(HOME|AUTO|FIRE|FLOOD)\b/i);
              if (lobMatch) header.lineOfBusiness = LOB_CODES[lobMatch[1].toUpperCase()] || lobMatch[1];
            }
            // Look for YYMMDDYYMMDD date pairs
            const dateMatch = cleanLine.match(/(\d{6})(\d{6})\s*$/m) || cleanLine.match(/(\d{6})(\d{6})/);
            if (dateMatch) {
              if (!header.effectiveDate) {
                const yy = parseInt(dateMatch[1].substring(0, 2), 10);
                const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
                header.effectiveDate = parseAL3Date(`${yyyy}${dateMatch[1].substring(2)}`);
              }
              if (!header.expirationDate) {
                const yy = parseInt(dateMatch[2].substring(0, 2), 10);
                const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
                header.expirationDate = parseAL3Date(`${yyyy}${dateMatch[2].substring(2)}`);
              }
            }
          }
        }
        break;
      }

      case AL3_GROUP_CODES.COVERAGE_VEHICLE: {
        // 6CVA: vehicle-level coverage with premium and limit
        if (isEDIFACTFormat(line)) {
          // EDIFACT (Allstate): multiple coverages packed in one record line
          const cvaList = parseEDIFACTHomeCoverages(line);
          for (const cva of cvaList) {
            if (currentVehicle) {
              currentVehicle.coverages.push(cva);
            } else {
              coverages.push(cva);
            }
          }
        } else {
          const cva = parse6LevelCoverage(line, 'vehicle');
          if (cva) {
            if (currentVehicle) {
              currentVehicle.coverages.push(cva);
            } else {
              coverages.push(cva);
            }
          }
        }
        break;
      }

      case AL3_GROUP_CODES.COVERAGE_HOME: {
        // 6CVH: home coverage record
        if (isEDIFACTFormat(line)) {
          // EDIFACT (Allstate): multiple coverages packed in one record line
          const cvhList = parseEDIFACTHomeCoverages(line);
          coverages.push(...cvhList);
        } else {
          const cvh = parse6LevelCoverage(line, 'home');
          if (cvh) {
            coverages.push(cvh);
          }
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

          // LOB from BPI positions 64-68 (more authoritative than 2TRG header)
          if (line.length > 69) {
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

        // EDIFACT (Allstate) branch: extract LOB and dates from segments
        if (isEDIFACTFormat(line)) {
          const segments = parseEDIFACTSegments(line);
          for (const seg of segments) {
            if (seg.tag === 'REF') continue;
            // LOB: segment containing HOME/AUTO/FIRE/FLOOD
            if (!header.lineOfBusiness) {
              const lobMatch = seg.data.match(/\b(HOME|AUTO|FIRE|FLOOD)\b/i);
              if (lobMatch) {
                header.lineOfBusiness = LOB_CODES[lobMatch[1].toUpperCase()] || lobMatch[1];
              }
            }
            // Dates: YYMMDD (6 digits) — first=effective, second=expiration
            // Also check for combined "YYMMDDYYMMDD" (12 digits) pattern
            if (!header.effectiveDate || !header.expirationDate) {
              const combinedMatch = seg.data.match(/(\d{6})(\d{6})/);
              if (combinedMatch) {
                if (!header.effectiveDate) {
                  const yy = parseInt(combinedMatch[1].substring(0, 2), 10);
                  const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
                  header.effectiveDate = parseAL3Date(`${yyyy}${combinedMatch[1].substring(2)}`);
                }
                if (!header.expirationDate) {
                  const yy = parseInt(combinedMatch[2].substring(0, 2), 10);
                  const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
                  header.expirationDate = parseAL3Date(`${yyyy}${combinedMatch[2].substring(2)}`);
                }
              } else if (/^\d{6}$/.test(seg.data)) {
                const yy = parseInt(seg.data.substring(0, 2), 10);
                const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
                const parsed = parseAL3Date(`${yyyy}${seg.data.substring(2)}`);
                if (parsed) {
                  if (!header.effectiveDate) {
                    header.effectiveDate = parsed;
                  } else if (!header.expirationDate) {
                    header.expirationDate = parsed;
                  }
                }
              }
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
            // Match numeric or hyphenated policy numbers (e.g., "0301-2100-0999")
            const altMatch = bpiContent.match(/\b(\d[\d-]{5,15}\d)\b/);
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

        // PREMIUM EXTRACTION - this is the authoritative policy premium
        // AL3 5BPI format: positions 109-120 = annual premium (11 digits + sign, cents)
        // Universal pattern fallback: look for 11-digit premium patterns like "00000238000+"
        if (!totalPremium && line.length > 120) {
          // Look for 11-digit number followed by +/- sign (standard AL3 premium format)
          // Must be 11 digits to avoid matching dates (8 digits) or other numbers
          const premiumPatterns = line.substring(100).match(/(\d{11})[+-]/g);
          if (premiumPatterns && premiumPatterns.length > 0) {
            for (const pattern of premiumPatterns) {
              const rawPremium = pattern.replace(/[+-]$/, '');
              const val = parseInt(rawPremium, 10);
              // Validate: reasonable premium range ($50 - $100,000)
              const dollars = val / 100;
              if (dollars >= 50 && dollars <= 100000) {
                totalPremium = dollars;
                break;
              }
            }
          }
        }
        // EDIFACT fallback: Allstate uses different format
        if (!totalPremium && isEDIFACTFormat(line)) {
          const segments = parseEDIFACTSegments(line);
          for (const seg of segments) {
            // Look for premium in segment data: 8-10 digits ending with +/-
            const match = seg.data.match(/^(\d{7,10})[+-]$/);
            if (match) {
              const val = parseInt(match[1], 10);
              const dollars = val / 100;
              if (dollars >= 50 && dollars <= 100000) {
                totalPremium = dollars;
                break;
              }
            }
          }
        }
        break;
      }

      default: {
        // Handle record types by their 4-char group code prefix
        const gc = getGroupCode(line);

        if (gc === '9BIS' && !insuredAddress) {
          // 9BIS: Insured address continuation
          // Try EDIFACT (Allstate) first
          if (isEDIFACTFormat(line)) {
            const result = parseAllstateAddress(line);
            if (result) {
              insuredAddress = result.location;
              if (!insuredPhone && result.phone) insuredPhone = result.phone;
            }
          } else {
            insuredAddress = parseBISAddress(line) ?? undefined;
          }
          // Extract phone from 9BIS if available (position-based fallback)
          if (!insuredPhone && insuredAddress && !isEDIFACTFormat(line)) {
            const fields = line.length > 130 ? BIS_ADDRESS_FIELDS : BIS_ADDRESS_FIELDS_SHORT;
            const phone = extractField(line, fields.PHONE).replace(/\?+/g, '').trim();
            if (phone && /^\d{7,}$/.test(phone)) {
              insuredPhone = phone;
            }
          }
        } else if (gc === '5ISI' && isEDIFACTFormat(line)) {
          // 5ISI: Insured Supplemental Info — may contain embedded 5BPI with policy number
          if (!header.policyNumber) {
            const cleanLine = line.replace(/[\x00-\x1F\x7F-\xFF]/g, ' ');
            const policyMatch = cleanLine.match(/5BPI\d{3}[^]*?\s{2,}(\d[\d-]{5,15}\d)\b/);
            if (policyMatch) header.policyNumber = policyMatch[1];
          }
        } else if (gc === '5AOI') {
          // 5AOI: Additional Other Insured (mortgagee/lienholder)
          const mortgagee = parseMortgagee(line);
          if (mortgagee) mortgagees.push(mortgagee);
        } else if (gc === '6COM') {
          // 6COM: Communication record (email, phone)
          if (isEDIFACTFormat(line)) {
            // EDIFACT (Allstate): extract type and value from segments
            const segments = parseEDIFACTSegments(line);
            let commType = '';
            let commValue = '';
            for (const seg of segments) {
              if (seg.tag === 'REF') continue;
              if (/\b(EMAIL|PHONE|CELL)\b/i.test(seg.data)) {
                commType = seg.data.match(/\b(EMAIL|PHONE|CELL)\b/i)?.[1]?.toUpperCase() || '';
              } else if (seg.data.includes('@')) {
                commValue = seg.data;
              } else if (/^\d{10,}$/.test(seg.data)) {
                commValue = seg.data;
              }
            }
            if (commType === 'EMAIL' && commValue && commValue.includes('@')) {
              insuredEmail = commValue.toLowerCase();
            } else if ((commType === 'PHONE' || commType === 'CELL') && commValue && /^\d{7,}$/.test(commValue)) {
              if (!insuredPhone) insuredPhone = commValue;
            }
          } else {
            const commType = extractField(line, COM_FIELDS.COMM_TYPE).toUpperCase();
            const commValue = extractField(line, COM_FIELDS.VALUE).replace(/\?+/g, '').trim();
            if (commType === 'EMAIL' && commValue && commValue.includes('@')) {
              insuredEmail = commValue.toLowerCase();
            } else if ((commType === 'PHONE' || commType === 'CELL') && commValue && /^\d{7,}$/.test(commValue)) {
              if (!insuredPhone) insuredPhone = commValue;
            }
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
        } else if (gc === '2TCG' && isEDIFACTFormat(line)) {
          // 2TCG: Transaction Content Group — in Allstate EDIFACT, contains insured name
          // and address data that supplements (and may be more complete than) the 5BIS record.
          // Extract name from segments: tag 08=first name, 0A/0B/0C=last name parts
          if (!header.insuredName || header.insuredName.split(' ').length <= 1) {
            const segments = parseEDIFACTSegments(line);
            const nameParts: string[] = [];
            let pastEntityType = false;
            for (const seg of segments) {
              if (seg.tag === 'REF' || seg.tag === 'SUB') continue;
              // Entity type: single char P, C, F, G
              if (!pastEntityType && /^[PCFGIN]$/.test(seg.data)) {
                pastEntityType = true;
                continue;
              }
              pastEntityType = true;
              // Stop at non-name data
              if (/^\d+[+-]?$/.test(seg.data)) break;
              if (/^[A-Z]{1,2}\d{4,}/.test(seg.data)) break;
              if (/\d/.test(seg.data) && /[a-zA-Z]/.test(seg.data)) break;
              if (/^(IN|FL|OUT|SEP|HOS|POT)$/i.test(seg.data)) break;
              // Embedded record header
              if (/^\d[A-Z]{3}\d{3}/.test(seg.data)) break;
              if (/^[A-Za-z][A-Za-z .&'\-]*$/.test(seg.data)) {
                nameParts.push(seg.data.trim());
              } else if (seg.data.length === 0) {
                continue;
              } else {
                break;
              }
            }
            if (nameParts.length > 0) {
              const name = nameParts.filter(p => p.length > 0).join(' ').replace(/\s+/g, ' ').trim();
              if (name.length > 2) header.insuredName = name;
            }
          }
        } else if (gc === '5LAG') {
          // 5LAG: Location Address Group — use proper reference positions
          const loc = parseLAGLocation(line);
          if (loc) locations.push(loc);
        } else if ((gc === '6HRU' || gc === '6FRU') && isEDIFACTFormat(line)) {
          // 6HRU/6FRU: Home/Fire Underwriting — may contain embedded 5AOI mortgagee data
          // AND embedded 6CVH coverage sub-records (DWELL, OS, CONT, LOU, PL).
          // In Allstate EDIFACT, the mortgagee name is embedded in a segment containing "5AOI"
          // Pattern: "50?5AOI204 6 R200016HRUR10001    001MG01?CHometown Bank Of Alabama"
          const rawParts: string[] = [];
          let partStart = 0;
          for (let i = 0; i < line.length; i++) {
            if (line.charCodeAt(i) === 0xFA) {
              rawParts.push(line.substring(partStart, i));
              partStart = i + 1;
            }
          }
          rawParts.push(line.substring(partStart));

          for (const part of rawParts) {
            // Look for segments containing embedded 5AOI with mortgagee data
            // Pattern: "50?5AOI...001MG01?C<name>" or "50?5AOI...001LP01?C<name>"
            const aoiMatch = part.match(/5AOI\d{3}[^]*?001([A-Z]{2})01\?([CP])(.+)/);
            if (aoiMatch) {
              const interestType = aoiMatch[1]; // MG, LP, etc.
              let name = aoiMatch[3].replace(/[\x00-\x1F\x7F-\xFF]/g, '').trim();
              // Clean trailing noise
              name = name.replace(/\d[A-Z]{3}\d{3}.*$/, '').trim();
              if (name.length > 2) {
                mortgagees.push({
                  interestType,
                  name,
                });
              }
            }
          }

          // Also extract loan number from segments with tag "12"
          // Pattern: "12?40821544 1"
          if (mortgagees.length > 0) {
            const lastMortgagee = mortgagees[mortgagees.length - 1];
            if (!lastMortgagee.loanNumber) {
              for (const part of rawParts) {
                const clean = part.replace(/[\x00-\x1F\x7F-\xFF]/g, '').trim();
                const loanMatch = clean.match(/^12\?(\d{5,})/);
                if (loanMatch) {
                  lastMortgagee.loanNumber = loanMatch[1];
                  break;
                }
              }
            }
          }

          // Extract embedded 6CVH coverage sub-records from 6HRU/6FRU lines.
          // Some carriers pack the first few coverages (DWELL, OS, CONT, LOU, PL)
          // inside the 6HRU line rather than as standalone 6CVH lines.
          if (line.includes('6CVH')) {
            const cvhList = parseEDIFACTHomeCoverages(line);
            coverages.push(...cvhList);
          }
        } else if (gc === '5REP' && isEDIFACTFormat(line) && line.includes('6CVH')) {
          // 5REP: Replacement cost/property report — some carriers (CAN STRATEGIC)
          // embed the first coverage sub-records (DWELL, OS, PP) inside this line.
          const cvhList = parseEDIFACTHomeCoverages(line);
          coverages.push(...cvhList);
        } else if (gc === '9AOI' && isEDIFACTFormat(line) && line.includes('6CVH')) {
          // 9AOI: Additional Interest continuation — some carriers (American Strategic)
          // embed 5REP and 6CVH coverage sub-records (e.g. DWELL) inside this line.
          const cvhList = parseEDIFACTHomeCoverages(line);
          coverages.push(...cvhList);
        }
        break;
      }
    }
  }

  // Save last vehicle
  if (currentVehicle) vehicles.push(currentVehicle);

  // Deduplicate coverages (EDIFACT records can produce duplicates from overlapping record splits)
  const seen = new Set<string>();
  const uniqueCoverages: AL3Coverage[] = [];
  for (const c of coverages) {
    const key = `${c.code}|${c.premium ?? ''}|${c.limitAmount ?? ''}|${c.description ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCoverages.push(c);
    }
  }

  // Reclassify LOB based on actual coverage records (overrides potentially wrong 2TRG LOB)
  if (hasHomeCoverages) {
    // Home coverages present — ensure LOB reflects that (fixes misaligned 2TRG LOB codes like "UM")
    if (!header.lineOfBusiness || header.lineOfBusiness === 'Umbrella' || header.lineOfBusiness === 'Personal Auto') {
      header.lineOfBusiness = 'Homeowners';
    }
  } else if (uniqueCoverages.length > 0 || vehicles.length > 0) {
    const autoCodes = new Set(['BI', 'PD', 'COLL', 'COMP', 'UM', 'MEDPM', 'RREIM', 'TL', 'EXTCV']);
    // Check both policy-level and vehicle-level coverages for auto codes
    const hasAutoCode = uniqueCoverages.some(c =>
      autoCodes.has(c.code.toUpperCase()) || autoCodes.has(c.description?.toUpperCase() || '')
    ) || vehicles.some(v =>
      v.coverages.some(c => autoCodes.has(c.code.toUpperCase()) || autoCodes.has(c.description?.toUpperCase() || ''))
    );
    if (hasAutoCode) {
      header.lineOfBusiness = 'Personal Auto';
    }
  }

  // Adjust confidence based on data completeness
  if (header.policyNumber && header.transactionType) confidence += 0.1;
  if (coverages.length > 0 || vehicles.length > 0) confidence += 0.1;
  if (header.effectiveDate) confidence += 0.05;
  if (insuredAddress) confidence += 0.05;
  confidence = Math.min(confidence, 1.0);

  return {
    header,
    coverages: uniqueCoverages,
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
    totalPremium,
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
  // Fix truncated carrier names from EDIFACT-delimited records
  if (cleanCarrierName === 'LSTATE') cleanCarrierName = 'ALLSTATE';
  if (cleanCarrierName === 'CAN STRATEGIC') cleanCarrierName = 'AMERICAN STRATEGIC';
  if (cleanCarrierName === 'RSAL P&C INS CO') cleanCarrierName = 'UNIVERSAL P&C INS CO';

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

  // Clean up carrier name: strip trailing agency IDs and garbage
  if (header.carrierName) {
    // Strip trailing agency ID patterns like "IBMYX67JQA", "159786", "HAWKSOFT"
    header.carrierName = header.carrierName
      .replace(/IBM[A-Z0-9]{5,}.*$/i, '')  // IBMYX67JQA...
      .replace(/\s*\d{5,}.*$/, '')          // 159786...
      .replace(/\s*HAWKSOFT.*$/i, '')       // HAWKSOFT...
      .replace(/\s*TCDS.*$/i, '')           // TCDS Insurance Agency...
      .trim();
  }

  // Fix truncated carrier names from 33-char field width
  if (header.carrierName) {
    const CARRIER_NAME_FIXES: Record<string, string> = {
      'ial Fire & Casualty': 'National General Insurance Co',
      'nalGeneral OneChoice': 'National General OneChoice',
      'WNERS ASSOC OF AMERI': 'Homeowners Association of America',
      'on General Ins Corp': 'Integon General Insurance Corp',
      'ONAL GENERAL INS CO': 'National General Insurance Co',
      'NPS AUTOP Integon Indemnity Corp': 'Integon Indemnity Corp',
      'CAN MODERN INSURANCE': 'American Modern Insurance',
      'HILL INSURANCE': 'Churchill Insurance',
    };
    for (const [fragment, full] of Object.entries(CARRIER_NAME_FIXES)) {
      if (header.carrierName === fragment || header.carrierName.includes(fragment)) {
        header.carrierName = full;
        break;
      }
    }
  }

  // Last resort: carrier code → carrier name fallback
  // Some carriers (e.g., National General) don't put their name in the 2TRG
  if (!header.carrierName && header.carrierCode) {
    const CARRIER_CODE_FALLBACKS: Record<string, string> = {
      '98': 'National General',
    };
    if (CARRIER_CODE_FALLBACKS[header.carrierCode]) {
      header.carrierName = CARRIER_CODE_FALLBACKS[header.carrierCode];
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
  if (!code) return null;

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
  if (!code) return null;

  if (type === 'vehicle') {
    // 6CVA: premium at 60 (implied 2 decimals + sign), limits at 102+, deductible at 122+
    const premiumStr = extractField(line, CVA_FIELDS.PREMIUM).replace(/[+-]$/, '');
    const limitStr = extractField(line, CVA_FIELDS.LIMIT);
    const limit2Str = extractField(line, CVA_FIELDS.LIMIT_2);
    const deductibleStr = extractField(line, CVA_FIELDS.DEDUCTIBLE);
    const descriptionStr = line.length > 145 ? extractField(line, CVA_FIELDS.DESCRIPTION) : '';
    const premium = parseAL3Number(premiumStr);
    const limitAmount = parseAL3Number(limitStr);
    // Parse deductible: extract leading digits, ignore trailing type codes like "G2", "PR"
    // Format is zero-padded 6 digits (e.g., "000500" = $500)
    const cleanDedStr = deductibleStr.trim();
    const dedDigits = cleanDedStr.match(/^(\d+)/);
    const deductibleAmount = dedDigits && parseInt(dedDigits[1], 10) > 0
      ? parseInt(dedDigits[1], 10)
      : undefined;

    // Use human-readable description from 6CVA if available
    const cleanDesc = descriptionStr
      ?.replace(/[\x00-\x1F\x7F-\xFF]/g, ' ')
      .replace(/\?+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Check if this is a known discount code
    const mappedType = COVERAGE_CODE_MAP[code.toUpperCase()] || COVERAGE_CODE_MAP[code];
    const isDiscountCode = mappedType && DISCOUNT_COVERAGE_TYPES.has(mappedType);

    // Skip truly empty records (no premium, no limit, no deductible, no description)
    // BUT keep discount codes even without numeric values
    if (!premium && !limitAmount && !deductibleAmount && !cleanDesc && !isDiscountCode) return null;

    // Build limit display string for split limits (BI, UM, UMBI)
    // Format: Limit 1 (10 chars) = [7 digits per-person][3 digits per-accident prefix]
    // Limit 2 (5+ chars) = per-accident suffix
    // Example: "0100000003" + "00000" → $100,000/$300,000
    let displayLimit = limitStr || undefined;
    let finalLimitAmount = limitAmount;
    const upperCode = code.toUpperCase();
    // Strip date suffix and whitespace from code for split limit detection
    // e.g., "BI   260308" → "BI", "UM   260308" → "UM"
    const baseCode = upperCode.replace(/[\s_]*\d{4,6}$/, '').trim();
    const splitLimitCodes = ['BI', 'UM', 'UMBI', 'UMISP', 'UIM'];
    const isSplitLimit = splitLimitCodes.includes(baseCode);
    if (isSplitLimit && limitStr && limitStr.length >= 7) {
      const rawLimit = limitStr.replace(/[^0-9]/g, '');
      if (rawLimit.length >= 7) {
        const perPerson = parseInt(rawLimit.substring(0, 7), 10);
        const perAccidentPrefix = rawLimit.substring(7);
        const rawLimit2 = (limit2Str || '').replace(/[^0-9]/g, '');
        const perAccident = parseInt(perAccidentPrefix + rawLimit2, 10);
        if (perPerson > 0) {
          displayLimit = perAccident > 0 ? `${perPerson}/${perAccident}` : `${perPerson}`;
          finalLimitAmount = perPerson; // Use per-person amount for numeric comparison
        }
      }
    }

    // RREIM/RENT: rental reimbursement is daily/max format
    // AL3 stores as "0000050000" which parses to 50000
    // HawkSoft stores "50/1,500" (daily=$50, max=$1500)
    // Known carrier patterns:
    //   - Value divisible by 1000 with daily rate 20-100: daily*1000 encoding
    //   - Value < 200: raw daily amount
    //   - Value >= 200 but not fitting patterns: leave as-is (comparison will flag)
    if ((baseCode === 'RREIM' || baseCode === 'RENT') && limitAmount) {
      if (limitAmount >= 1000 && limitAmount % 1000 === 0) {
        const daily = limitAmount / 1000;
        // Only apply heuristic for reasonable daily rates ($20-$100)
        if (daily >= 20 && daily <= 100) {
          const max = daily * 30;
          displayLimit = `${daily}/${max}`;
          finalLimitAmount = daily;
        }
        // Values like 1000 ($1/day?) or 200000 ($200/day?) are left as-is
      } else if (limitAmount < 200) {
        // Raw daily amount (e.g., 50 → $50/day)
        const daily = limitAmount;
        const max = daily * 30;
        displayLimit = `${daily}/${max}`;
        finalLimitAmount = daily;
      }
      // Values 200-999 or large non-divisible values are left as-is
    }

    // Clean non-split limit strings: strip leading zeros for readable display
    if (displayLimit && !isSplitLimit && !(baseCode === 'RREIM' || baseCode === 'RENT')) {
      const numericOnly = displayLimit.replace(/[^0-9]/g, '');
      if (numericOnly.length > 0 && /^0+\d/.test(numericOnly)) {
        const cleaned = numericOnly.replace(/^0+/, '') || '0';
        displayLimit = cleaned;
      }
    }

    // For discount codes, use a human-readable description from the mapped type
    let finalDescription = cleanDesc || code;
    if (isDiscountCode && mappedType) {
      // Convert 'accident_free_discount' to 'Accident Free Discount'
      finalDescription = mappedType
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    return {
      code,
      description: finalDescription,
      limit: displayLimit,
      limitAmount: finalLimitAmount,
      deductible: deductibleStr || undefined,
      deductibleAmount,
      premium: premium ? premium / 100 : undefined, // IVANS premiums are in cents
    };
  } else {
    // 6CVH: home/watercraft coverage record
    // Different carriers use different field positions:
    //   - SAFECO 6CVH240: limit at 60-72, secondary at 90-101
    //   - Openly 6CVH323: limit at ~86, description at ~150
    // Use pattern-based extraction as fallback when fixed positions yield nothing

    // Try fixed positions first (works for SAFECO)
    let primaryStr = extractField(line, CVH_FIELDS.LIMIT);
    let secondaryStr = extractField(line, CVH_FIELDS.SECONDARY_AMOUNT);

    // Detect if primary field is premium (has +/- sign) or limit
    const hasPremiumSign = /[+-]$/.test(primaryStr.trim());

    let premium: number | undefined;
    let limitAmount: number | undefined;
    let limitStr: string | undefined;
    let deductibleAmount: number | undefined;
    let deductibleStr: string | undefined;

    if (hasPremiumSign) {
      // Watercraft format: primary is premium, secondary is limit
      const premiumRaw = primaryStr.replace(/[+-]$/, '');
      premium = parseAL3Number(premiumRaw);
      if (premium) premium = premium / 100;
      limitAmount = parseAL3Number(secondaryStr);
      limitStr = secondaryStr || undefined;
    } else {
      // Home format: primary is limit
      limitAmount = parseAL3Number(primaryStr);
      const secondaryAmount = parseAL3Number(secondaryStr);
      if (!limitAmount && secondaryAmount) {
        limitAmount = secondaryAmount;
        limitStr = secondaryStr;
      } else {
        limitStr = primaryStr || undefined;
      }
    }

    // FALLBACK: Pattern-based extraction for non-standard formats (Openly, etc.)
    // If fixed positions yielded no limit, scan the line for numeric patterns
    if (!limitAmount && line.length > 100) {
      // Extract the data portion after the coverage code (position 45+)
      const dataSection = line.substring(45);

      // AL3 limits are typically 8-digit zero-padded (e.g., "05000000" = $500,000)
      // Openly concatenates limit+deductible like "0500000001000" (limit 8 digits + ded 5 digits)
      // First try to find 8-digit sequences
      const eightDigitPattern = /(\d{8})/g;
      const eightDigitMatches = [...dataSection.matchAll(eightDigitPattern)];

      if (eightDigitMatches.length > 0) {
        // First 8-digit number is the limit
        const rawLimit = eightDigitMatches[0][1];
        const parsedLimit = parseInt(rawLimit.replace(/^0+/, '') || '0', 10);
        if (parsedLimit > 0) {
          limitAmount = parsedLimit;
          limitStr = String(parsedLimit);
        }

        // Check if there's a deductible immediately after the limit (5-7 digits pattern)
        const limitEndPos = (eightDigitMatches[0].index ?? 0) + 8;
        const afterLimit = dataSection.substring(limitEndPos, limitEndPos + 10);
        const dedMatch = afterLimit.match(/^(\d{4,7})/);
        if (dedMatch) {
          const parsedDed = parseInt(dedMatch[1].replace(/^0+/, '') || '0', 10);
          if (parsedDed > 0 && parsedDed <= 25000) {
            deductibleAmount = parsedDed;
            deductibleStr = String(parsedDed);
          }
        }

        // Also check if there's a duplicate limit at end of line (Openly format)
        // This is useful for validation but we don't need to capture it twice
      } else {
        // No 8-digit sequence found, try shorter patterns for deductible-only records
        const shortPattern = /(\d{5,7})/;
        const shortMatch = dataSection.match(shortPattern);
        if (shortMatch) {
          const parsedVal = parseInt(shortMatch[1].replace(/^0+/, '') || '0', 10);
          // Distinguish between small deductibles and larger limits
          if (parsedVal > 0 && parsedVal <= 25000) {
            deductibleAmount = parsedVal;
            deductibleStr = String(parsedVal);
          } else if (parsedVal > 25000) {
            limitAmount = parsedVal;
            limitStr = String(parsedVal);
          }
        }
      }
    }

    // Extract description from end of line (pattern-based)
    // Look for readable text after position 100 (where descriptions typically appear)
    let description = code;
    if (line.length > 150) {
      const endSection = line.substring(100).trim();
      // Find first run of alphabetic text (the description)
      const descMatch = endSection.match(/([A-Z][a-zA-Z]+(?:\s+[A-Za-z]+)*)/);
      if (descMatch && descMatch[1].length > 2) {
        description = descMatch[1].trim();
      }
    }

    // Check if this is a known discount code
    const mappedType = COVERAGE_CODE_MAP[code.toUpperCase()] || COVERAGE_CODE_MAP[code];
    const isDiscountCode = mappedType && DISCOUNT_COVERAGE_TYPES.has(mappedType);

    // Skip records with no useful data, BUT keep discount codes and endorsements
    // Some coverages (sinkhole, mine subsidence) are included even without limits
    const hasDescription = description && description !== code && description.length > 3;
    if (!premium && !limitAmount && !isDiscountCode && !hasDescription) return null;

    // For discount codes, use a human-readable description
    let finalDescription = description;
    if (isDiscountCode && mappedType) {
      finalDescription = mappedType
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    return {
      code,
      description: finalDescription,
      limit: limitStr,
      limitAmount,
      deductible: deductibleStr,
      deductibleAmount,
      premium,
    };
  }
}

/**
 * Parse a form/endorsement schedule record (5FOR).
 */
function parseForm(line: string): AL3Endorsement | null {
  // EDIFACT (Allstate): extract form number and description from segments
  if (isEDIFACTFormat(line)) {
    const segments = parseEDIFACTSegments(line);
    let formNumber = '';
    let description = '';
    for (const seg of segments) {
      if (seg.tag === 'REF') continue;
      // Form number: alphanumeric segment (e.g., "A206 AL")
      if (!formNumber && /[A-Z0-9]/.test(seg.data) && seg.data.length <= 20) {
        formNumber = seg.data;
      }
      // Description: longer text segment
      if (!description && /[a-zA-Z]{3,}/.test(seg.data) && seg.data.length > formNumber.length) {
        description = seg.data;
      }
    }
    if (!formNumber && !description) return null;
    return {
      code: formNumber || 'FORM',
      description: description || formNumber || undefined,
      effectiveDate: undefined,
      premium: undefined,
    };
  }

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
 * Uses fixed positions with pattern-based fallbacks for carrier variations.
 */
function parseVehicle(line: string): AL3Vehicle {
  // Try fixed positions first
  let vin = extractField(line, VEH_FIELDS.VIN) || undefined;
  let year = parseAL3Number(extractField(line, VEH_FIELDS.YEAR)) as number | undefined;
  let make = extractField(line, VEH_FIELDS.MAKE) || undefined;
  let model = extractField(line, VEH_FIELDS.MODEL) || undefined;

  // UNIVERSAL FALLBACKS using pattern extraction

  // VIN: 17 alphanumeric characters (no I, O, Q)
  if (!vin || vin.length < 17) {
    const vinMatch = line.match(/[A-HJ-NPR-Z0-9]{17}/);
    if (vinMatch) vin = vinMatch[0];
  }

  // Year: 4-digit number in 1990-2030 range
  if (!year) {
    const yearMatch = line.match(/\b(19[9]\d|20[0-3]\d)\b/);
    if (yearMatch) year = parseInt(yearMatch[1], 10);
  }

  // Make/Model: Look for known auto manufacturer names if not found
  const cleanLine = line.replace(/[^\x20-\x7E]/g, ' ');
  if (!make) {
    const makePatterns = [
      'TOYOTA', 'HONDA', 'FORD', 'CHEVROLET', 'CHEVY', 'NISSAN', 'HYUNDAI', 'KIA',
      'BMW', 'MERCEDES', 'AUDI', 'LEXUS', 'ACURA', 'INFINITI', 'SUBARU', 'MAZDA',
      'VOLKSWAGEN', 'VW', 'JEEP', 'DODGE', 'RAM', 'CHRYSLER', 'BUICK', 'GMC',
      'CADILLAC', 'LINCOLN', 'TESLA', 'VOLVO', 'PORSCHE', 'JAGUAR', 'LAND ROVER',
      'MITSUBISHI', 'SUZUKI', 'FIAT', 'ALFA ROMEO', 'MINI', 'GENESIS', 'RIVIAN'
    ];
    for (const pattern of makePatterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(cleanLine)) {
        make = pattern.charAt(0) + pattern.slice(1).toLowerCase();
        break;
      }
    }
  }

  // Clean up make/model (remove non-printable chars)
  if (make) make = make.replace(/[^\x20-\x7E]/g, '').trim() || undefined;
  if (model) model = model.replace(/[^\x20-\x7E]/g, '').trim() || undefined;

  return { vin, year, make, model, usage: undefined, coverages: [] };
}

/**
 * Parse a driver record (5DRV).
 * IVANS format has a complex name field with type prefix and split first/last names.
 * Uses fixed positions with pattern-based fallbacks for carrier variations.
 */
function parseDriver(line: string): AL3Driver | null {
  // Extract raw name area (positions 39-97: first name + last name)
  let rawName = extractField(line, DRV_FIELDS.NAME);
  if (!rawName) return null;

  // Clean non-printable characters and collapse whitespace
  rawName = rawName.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!rawName) return null;

  // Parse DOB — try multiple strategies with pattern fallback
  let dateOfBirth: string | undefined;

  // Strategy 1: YYYYMMDD at fixed position
  const dobFull = extractField(line, DRV_FIELDS.DOB_FULL);
  if (dobFull && /^\d{8}$/.test(dobFull)) {
    dateOfBirth = parseAL3Date(dobFull);
  }

  // Strategy 2: YYMMDD at fixed position
  if (!dateOfBirth) {
    const dobRaw = extractField(line, DRV_FIELDS.DOB);
    if (dobRaw && /^\d{6}$/.test(dobRaw)) {
      const yy = parseInt(dobRaw.substring(0, 2), 10);
      const mm = dobRaw.substring(2, 4);
      const dd = dobRaw.substring(4, 6);
      const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
      dateOfBirth = parseAL3Date(`${yyyy}${mm}${dd}`);
    }
  }

  // Strategy 3: UNIVERSAL FALLBACK - scan for date patterns anywhere in line
  if (!dateOfBirth) {
    // Look for YYYYMMDD pattern (1920-2010 birth years for drivers)
    const dobMatch = line.match(/\b(19[2-9]\d|200\d|201\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/);
    if (dobMatch) {
      dateOfBirth = parseAL3Date(dobMatch[0]);
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
 * Parse a 6SDV supplementary driver record (commercial auto).
 * Format: 6SDV256 D ... driver_num + flags + P + FIRSTNAME + LASTNAME + DOB
 */
function parseSupplementaryDriver(line: string): AL3Driver | null {
  if (line.length < 80) return null;

  // Find name region — look for capitalized name parts after the header
  // 6SDV format puts first name ~38 chars in, last name ~63 chars in
  const content = line.substring(30);

  // Extract first name (positions 38-62 relative to line start = 8-32 in content)
  const firstName = content.substring(8, 35).replace(/[^\x20-\x7E]/g, ' ').trim();
  // Extract last name (positions 63-87 = 33-57 in content)
  const lastName = content.substring(33, 60).replace(/[^\x20-\x7E]/g, ' ').trim();

  if (!firstName && !lastName) return null;

  const name = [firstName, lastName].filter(Boolean).join(' ');
  if (!name) return null;

  // Extract DOB — look for YYMMDD or YYYYMMDD pattern
  let dateOfBirth: string | undefined;

  // Look for YYYYMMDD pattern (1920-2010 birth years)
  const dobMatch = line.match(/\b(19[2-9]\d|200\d|201\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/);
  if (dobMatch) {
    dateOfBirth = parseAL3Date(dobMatch[0]);
  } else {
    // Try YYMMDD at end of line
    const endDigits = line.substring(line.length - 20).match(/(\d{6})/);
    if (endDigits) {
      const yy = parseInt(endDigits[1].substring(0, 2), 10);
      const mm = endDigits[1].substring(2, 4);
      const dd = endDigits[1].substring(4, 6);
      const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
      dateOfBirth = parseAL3Date(`${yyyy}${mm}${dd}`);
    }
  }

  return {
    name,
    dateOfBirth,
    licenseNumber: undefined,
    licenseState: undefined,
    relationship: undefined,
  };
}

/**
 * Parse a 5CAR commercial vehicle record.
 * Format: 5CAR418 C ... vehicle_num + flags + YEAR + MAKE + MODEL + VIN
 */
function parseCommercialVehicle(line: string): AL3Vehicle {
  const content = line.substring(30);

  // Extract year (4 digits - may follow ???? markers without word boundary)
  let year: number | undefined;
  const yearMatch = content.match(/(19[89]\d|20[0-2]\d)/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  // Extract VIN (17 alphanumeric chars pattern)
  let vin: string | undefined;
  const vinMatch = line.match(/[A-HJ-NPR-Z0-9]{17}/i);
  if (vinMatch) {
    vin = vinMatch[0].toUpperCase();
  }

  // Extract make and model — typically after year, before VIN
  let make = '';
  let model = '';

  if (yearMatch) {
    const afterYear = content.substring(content.indexOf(yearMatch[1]) + 4);
    // Make is first word, model is remaining words before VIN
    const parts = afterYear.replace(/[^\x20-\x7E]/g, ' ').trim().split(/\s+/);
    if (parts.length > 0) {
      make = parts[0];
      // Model is next parts until we hit the VIN or type code
      const modelParts: string[] = [];
      for (let i = 1; i < parts.length && i < 5; i++) {
        if (parts[i].length >= 17 || /^[A-Z]$/.test(parts[i])) break; // Stop at VIN or type code
        modelParts.push(parts[i]);
      }
      model = modelParts.join(' ');
    }
  }

  return {
    vin,
    year,
    make,
    model,
    usage: undefined,
    coverages: [],
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
 * Parse an Allstate EDIFACT-format 9BIS address record.
 * Segments are 0xFA-delimited with pattern-matched fields.
 */
function parseAllstateAddress(line: string): { location: AL3Location; phone?: string } | null {
  // Split on 0xFA and process segments — look for address data
  // In 5BIS lines, address data comes after the 9BIS header boundary
  // In standalone 9BIS lines, address data is in the first few segments
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < line.length; i++) {
    if (line.charCodeAt(i) === 0xFA) {
      parts.push(line.substring(start, i));
      start = i + 1;
    }
  }
  parts.push(line.substring(start));

  // Clean each part: strip non-printable chars, strip 2-char hex tag, strip ? filler
  // Track whether we've passed the address section boundary (9BIS header or address-like data)
  const cleanParts: string[] = [];
  let foundAddressSection = false;
  const gc = line.substring(0, 4);

  for (let i = 1; i < parts.length; i++) { // Skip first (REF) part
    let d = parts[i].replace(/[\x00-\x1F\x7F-\xFF]/g, '');
    // Strip 2-char hex tag
    const tagMatch = d.match(/^[0-9A-Fa-f]{2}\s?(.*)/);
    if (tagMatch) d = tagMatch[1];
    d = d.replace(/\?+/g, '').trim();
    if (!d) continue;

    // For 5BIS lines: skip segments until we hit a 9BIS header or address-like data
    if (gc === '5BIS' && !foundAddressSection) {
      if (/9BIS\d{3}/.test(d)) {
        foundAddressSection = true;
        continue; // Skip the header itself
      }
      // Also detect address start: segment with digits + letters (street address)
      if (/\d/.test(d) && /[a-zA-Z]/.test(d) && d.length > 5 && !/^\d[A-Z]{3}/.test(d)) {
        foundAddressSection = true;
        cleanParts.push(d);
      }
      continue;
    }

    // For standalone 9BIS, start parsing immediately
    if (gc === '9BIS') foundAddressSection = true;

    cleanParts.push(d);
  }

  let address: string | undefined;
  let city: string | undefined;
  let state: string | undefined;
  let zip: string | undefined;
  let phone: string | undefined;

  for (const d of cleanParts) {
    // Skip record headers (e.g., "5ISI203 B B200015BISB10001")
    if (/^\d[A-Z]{3}\d{3}/.test(d)) break; // Stop at next embedded record
    // Skip long numeric/code strings
    if (/^\d{8,}/.test(d) && !/^\d{10}$/.test(d)) continue;

    // State+ZIP: 2 uppercase letters followed by 5 digits (e.g., "AL35033", "AL352156718")
    if (!state && /^[A-Z]{2}\d{5}/.test(d)) {
      state = d.substring(0, 2);
      zip = d.substring(2, 7);
      // Check for embedded phone: "AL352156718" → zip=35215, phone=6718 (partial)
      // "AL3509378229065" → zip=35093, phone area embedded
      if (d.length >= 12) {
        const phoneCandidate = d.substring(7);
        if (/^\d{7,10}$/.test(phoneCandidate)) phone = phoneCandidate;
      }
      continue;
    }

    // Phone: exactly 10 digits
    if (!phone && /^\d{10}$/.test(d)) {
      phone = d;
      continue;
    }

    // Address: contains both digits and letters (street address pattern)
    if (!address && /\d/.test(d) && /[a-zA-Z]/.test(d) && d.length > 5) {
      address = d;
      continue;
    }

    // City: alphabetic, 3-30 chars
    if (!city && /^[A-Za-z][A-Za-z .'\-]{2,29}$/.test(d)) {
      city = d;
      continue;
    }
  }

  if (!address && !city && !state) return null;

  return {
    location: {
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      zip: zip || undefined,
    },
    phone,
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

  // EDIFACT (Allstate): extract from 0xFA-delimited segments
  if (isEDIFACTFormat(line)) {
    const segments = parseEDIFACTSegments(line);
    let interestType: string | undefined;
    let name: string | undefined;
    let loanNumber: string | undefined;

    for (const seg of segments) {
      if (seg.tag === 'REF') continue;
      // Interest type: 2-char uppercase (LH, MS, CN)
      if (!interestType && /^[A-Z]{2}$/.test(seg.data)) {
        interestType = seg.data;
        continue;
      }
      // Loan number: numeric segment
      if (!loanNumber && /^\d{5,}$/.test(seg.data)) {
        loanNumber = seg.data;
        continue;
      }
      // Name: alpha segment with 3+ chars
      if (!name && /[a-zA-Z]{3,}/.test(seg.data) && !/^\d+$/.test(seg.data)) {
        let n = seg.data;
        // Strip entity type prefix (C/P)
        if (/^[CP][A-Z]/.test(n)) n = n.substring(1);
        name = n.trim();
        continue;
      }
    }

    if (!name) return null;
    return {
      interestType,
      name,
      loanNumber,
    };
  }

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
