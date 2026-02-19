// =============================================================================
// Shared AZ Service Ticket Description Formatter
// =============================================================================
// Provides a consistent, UI-friendly HTML format for all service ticket
// descriptions. AgencyZoom renders description fields as HTML.
// =============================================================================

/** Line break */
const BR = '<br />';
/** Paragraph break (blank line) */
const PBR = `<br />&nbsp;<br />`;

export interface TicketDescriptionParams {
  /** The AI summary of the call */
  summary?: string;
  /** Action items extracted from the call */
  actionItems?: string[];
  /** Extracted data (customer name, policy number, reason, etc.) */
  extractedData?: Record<string, string | undefined>;
  /** Caller phone number */
  callerPhone?: string;
  /** Customer name */
  customerName?: string;
  /** Call duration in seconds */
  durationSeconds?: number;
  /** The call transcript (HTML or plain text) */
  transcript?: string;
  /** Whether this is an NCM (non-customer-match) ticket */
  isNCM?: boolean;
  /** Sentiment classification (positive/neutral/negative) */
  sentiment?: string;
  /** Raw 3CX sentiment score (1-5) */
  sentimentScore?: number;
}

/**
 * Format a standard inbound call ticket description.
 */
export function formatInboundCallDescription(params: TicketDescriptionParams): string {
  const parts: string[] = [];

  // --- Service Request Details ---
  parts.push(`<b>🛠️ Service Request Details</b>${BR}`);
  parts.push(esc(params.summary || 'No summary available'));
  parts.push(PBR);

  // --- Customer Sentiment ---
  const sentimentHtml = formatSentimentHtml(params.sentiment, params.sentimentScore);
  if (sentimentHtml) {
    parts.push(`<b>💬 Customer Sentiment</b>${BR}`);
    parts.push(sentimentHtml);
    parts.push(PBR);
  }

  // --- Extracted Data ---
  const extractedParts: string[] = [];
  if (params.actionItems && params.actionItems.length > 0) {
    extractedParts.push(`Action Items:${BR}`);
    params.actionItems.forEach(item => extractedParts.push(`&bull; ${esc(item)}${BR}`));
  }
  if (params.extractedData) {
    const d = params.extractedData;
    if (d.customerName) extractedParts.push(`Customer: ${esc(d.customerName)}${BR}`);
    if (d.policyNumber) extractedParts.push(`Policy: ${esc(d.policyNumber)}${BR}`);
    if (d.reason) extractedParts.push(`Reason: ${esc(d.reason)}${BR}`);
  }
  if (extractedParts.length > 0) {
    parts.push(`<b>📊 Extracted Data from Call</b>${BR}`);
    parts.push(...extractedParts);
    parts.push(PBR);
  }

  // --- Call Information ---
  parts.push(`<b>📞 Call Information</b>${BR}`);
  if (params.callerPhone) {
    parts.push(`Phone Number: ${esc(params.callerPhone)}${PBR}`);
  }
  if (params.durationSeconds != null) {
    parts.push(`Call Duration: ${params.durationSeconds} seconds${PBR}`);
  }
  if (params.isNCM && params.callerPhone) {
    parts.push(`Caller Information: ${esc(params.customerName || 'Unknown')}${BR}`);
    parts.push(`Phone Number: ${esc(params.callerPhone)}${PBR}`);
  }

  // --- Transcript ---
  if (params.transcript) {
    parts.push(`<b>🗣️ Call Transcription</b>${BR}`);
    parts.push(cleanTranscriptHtml(params.transcript));
  }

  return parts.join('\n');
}

/**
 * Format an after-hours call ticket description.
 */
export function formatAfterHoursDescription(params: {
  callerName?: string;
  callerPhone: string;
  reason?: string;
  aiSummary?: string;
  transcript?: string;
  emailBody?: string;
  actionItems?: string[];
  isNCM?: boolean;
}): string {
  const parts: string[] = [];

  // --- Service Request Details ---
  parts.push(`<b>🛠️ Service Request Details</b>${BR}`);
  parts.push(esc(params.aiSummary || params.reason || 'After-hours call - callback requested'));
  parts.push(PBR);

  // --- Extracted Data ---
  const extractedParts: string[] = [];
  if (params.reason && params.reason !== params.aiSummary) {
    extractedParts.push(`Reason: ${esc(params.reason)}${BR}`);
  }
  if (params.actionItems && params.actionItems.length > 0) {
    extractedParts.push(`Action Items:${BR}`);
    params.actionItems.forEach(item => extractedParts.push(`&bull; ${esc(item)}${BR}`));
  }
  if (extractedParts.length > 0) {
    parts.push(`<b>📊 Extracted Data from Call</b>${BR}`);
    parts.push(...extractedParts);
    parts.push(PBR);
  }

  // --- Call Information ---
  parts.push(`<b>📞 Call Information</b>${BR}`);
  if (params.callerName) {
    parts.push(`Caller: ${esc(params.callerName)}${BR}`);
  }
  parts.push(`Phone Number: ${esc(params.callerPhone)}${PBR}`);
  if (params.isNCM) {
    parts.push(`Caller Information: ${esc(params.callerName || 'Unknown')}${BR}`);
    parts.push(`Phone Number: ${esc(params.callerPhone)}${PBR}`);
  }

  // --- Voicemail / ReceptionHQ ---
  if (params.transcript) {
    parts.push(`<b>🗣️ Voicemail Transcript</b>${BR}`);
    parts.push(cleanTranscriptHtml(params.transcript));
    parts.push(PBR);
  }

  if (params.emailBody && params.emailBody !== params.reason) {
    parts.push(`<b>📝 ReceptionHQ Notes</b>${BR}`);
    parts.push(esc(params.emailBody).replace(/\n/g, BR));
    parts.push(PBR);
  }

  return parts.join('\n');
}

/**
 * Format quote intake details for prepending to a ticket description.
 */
export function formatQuoteSection(params: {
  typeLabel: string;
  contact?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: { street?: string; city?: string; state?: string; zip?: string };
  } | null;
  vehicles?: Array<{
    year?: number; make?: string; model?: string; vin?: string;
    use?: string; annualMiles?: number;
  }> | null;
  drivers?: Array<{
    firstName?: string; lastName?: string; dob?: string;
    licenseNumber?: string; licenseState?: string;
  }> | null;
  property?: {
    address?: string | { street?: string; city?: string; state?: string; zip?: string };
    yearBuilt?: number; squareFeet?: number;
    constructionType?: string; roofType?: string; roofAge?: number;
  } | null;
  notes?: string | null;
}): string {
  const parts: string[] = [];

  parts.push(`<b>📋 Quote Intake - ${esc(params.typeLabel)}</b>${PBR}`);

  // Contact info
  if (params.contact) {
    const c = params.contact;
    const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
    const items: string[] = [];
    if (name) items.push(name);
    if (c.phone) items.push(c.phone);
    if (c.email) items.push(c.email);
    if (items.length > 0) parts.push(`Contact: ${esc(items.join(' | '))}${BR}`);
    if (c.address) {
      const addrParts = [c.address.street, c.address.city, c.address.state, c.address.zip].filter(Boolean);
      if (addrParts.length > 0) parts.push(`Address: ${esc(addrParts.join(', '))}${BR}`);
    }
    parts.push(PBR);
  }

  // Vehicles
  if (params.vehicles && params.vehicles.length > 0) {
    parts.push(`Vehicles:${BR}`);
    params.vehicles.forEach((v, i) => {
      const desc = [v.year, v.make, v.model].filter(Boolean).join(' ');
      const details: string[] = [];
      if (v.use) details.push(v.use);
      if (v.annualMiles) details.push(`${v.annualMiles.toLocaleString()} mi/yr`);
      parts.push(`&nbsp;&nbsp;${i + 1}. ${esc(desc)}${details.length ? ` - ${esc(details.join(', '))}` : ''}${BR}`);
    });
    parts.push(PBR);
  }

  // Drivers
  if (params.drivers && params.drivers.length > 0) {
    parts.push(`Drivers:${BR}`);
    params.drivers.forEach((d, i) => {
      const name = `${d.firstName || ''} ${d.lastName || ''}`.trim();
      const details: string[] = [];
      if (d.dob) details.push(`DOB: ${d.dob}`);
      if (d.licenseNumber) details.push(`DL# ${d.licenseNumber}`);
      if (d.licenseState) details.push(d.licenseState);
      parts.push(`&nbsp;&nbsp;${i + 1}. ${esc(name)}${details.length ? ` (${esc(details.join(', '))})` : ''}${BR}`);
    });
    parts.push(PBR);
  }

  // Property
  if (params.property) {
    const p = params.property;
    parts.push(`Property:${BR}`);
    if (p.address) {
      if (typeof p.address === 'string') {
        parts.push(`&nbsp;&nbsp;Address: ${esc(p.address)}${BR}`);
      } else {
        const items = [p.address.street, p.address.city, p.address.state, p.address.zip].filter(Boolean);
        if (items.length) parts.push(`&nbsp;&nbsp;Address: ${esc(items.join(', '))}${BR}`);
      }
    }
    const propDetails: string[] = [];
    if (p.yearBuilt) propDetails.push(`Built ${p.yearBuilt}`);
    if (p.squareFeet) propDetails.push(`${p.squareFeet.toLocaleString()} sq ft`);
    if (p.constructionType) propDetails.push(p.constructionType);
    if (p.roofType) propDetails.push(`${p.roofType} roof`);
    if (p.roofAge) propDetails.push(`Roof age: ${p.roofAge}yr`);
    if (propDetails.length) parts.push(`&nbsp;&nbsp;${esc(propDetails.join(', '))}${BR}`);
    parts.push(PBR);
  }

  // Notes
  if (params.notes) {
    parts.push(`Notes: ${esc(params.notes)}${PBR}`);
  }

  return parts.join('\n');
}

// =============================================================================
// Sentiment Emoji Helpers
// =============================================================================

const SENTIMENT_MAP: Record<string, Record<number, { emoji: string; label: string }>> = {
  positive: {
    5: { emoji: '🤩', label: 'Thrilled' },
    4: { emoji: '😄', label: 'Happy' },
  },
  neutral: {
    3: { emoji: '😐', label: 'Neutral' },
  },
  negative: {
    2: { emoji: '😢', label: 'Upset' },
    1: { emoji: '🤬', label: 'Angry' },
  },
};

/** Default emoji per sentiment when no score is available */
const SENTIMENT_DEFAULTS: Record<string, { emoji: string; label: string }> = {
  positive: { emoji: '😄', label: 'Happy' },
  neutral: { emoji: '😐', label: 'Neutral' },
  negative: { emoji: '😢', label: 'Upset' },
};

/**
 * Map sentiment classification + raw score to an emoji + label string.
 * Returns null if sentiment is missing.
 */
export function formatSentimentEmoji(
  sentiment?: string | null,
  score?: number | null,
): string | null {
  if (!sentiment) return null;
  const key = sentiment.toLowerCase();
  const entry = (score != null && SENTIMENT_MAP[key]?.[score])
    || SENTIMENT_DEFAULTS[key];
  if (!entry) return null;
  return `${entry.emoji} ${entry.label}`;
}

/**
 * HTML version of sentiment display for AZ ticket descriptions.
 * Returns null if sentiment is missing.
 */
export function formatSentimentHtml(
  sentiment?: string | null,
  score?: number | null,
): string | null {
  const display = formatSentimentEmoji(sentiment, score);
  if (!display) return null;
  const scoreStr = score != null ? ` (Score: ${score}/5)` : '';
  return `${display}${scoreStr}<br />`;
}

// =============================================================================
// Helpers
// =============================================================================

/** Redact financial PII from transcript text */
export function redactPII(text: string): string {
  // Credit/debit card numbers: 13-19 digits, optionally separated by spaces or dashes
  text = text.replace(
    /\b(\d[ -]?){12,18}\d\b/g,
    (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length >= 13 && digits.length <= 19) {
        return `[CARD ****${digits.slice(-4)}]`;
      }
      return match;
    }
  );

  // SSN: XXX-XX-XXXX or XXX XX XXXX
  text = text.replace(
    /\b(\d{3})[-\s](\d{2})[-\s](\d{4})\b/g,
    '[SSN REDACTED]'
  );

  // CVV/security codes: 3-4 digits after contextual keywords
  text = text.replace(
    /\b(security code|cvv|cvc|verification)[\s:]*(\d{3,4})\b/gi,
    '$1 [CVV REDACTED]'
  );

  // Bank routing numbers: 9 digits after "routing" context
  text = text.replace(
    /\b(routing(?:\s+number)?)[\s:]*(\d{9})\b/gi,
    (_, prefix, digits) => `${prefix} [ROUTING ****${digits.slice(-4)}]`
  );

  // Bank account numbers: digit sequences after "account" context
  text = text.replace(
    /\b(account(?:\s+number)?)[\s:]*(\d{4,17})\b/gi,
    (_, prefix, digits) => `${prefix} [ACCOUNT ****${digits.slice(-4)}]`
  );

  return text;
}

/** Escape HTML special characters */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Clean up transcript and convert to HTML line-broken format.
 * - Converts <p> wrapped lines to <br /> separated lines
 * - Collapses repeated filler lines
 * - Strips stray HTML tags
 */
function cleanTranscriptHtml(raw: string): string {
  let text = raw;

  // Strip <p> tags → newlines first (to normalize)
  text = text.replace(/<p>/gi, '');
  text = text.replace(/<\/p>/gi, '\n');

  // Strip <br /> and <br> tags
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Strip any remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Collapse repeated filler lines (3+ identical short lines in a row)
  text = text.replace(/^(.{1,20})\n(\1\n){2,}/gm, '$1\n');

  // Clean up excessive blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  // Redact financial PII before encoding to HTML
  text = redactPII(text);

  text = text.trim();

  // Convert back to HTML: each line gets a <br />
  // Escape HTML entities in the transcript text, then add line breaks
  const htmlLines = text.split('\n').map(line => esc(line.trim())).filter(l => l.length > 0);
  return htmlLines.join(BR + '\n');
}
