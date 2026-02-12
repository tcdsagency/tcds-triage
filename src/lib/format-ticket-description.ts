// =============================================================================
// Shared AZ Service Ticket Description Formatter
// =============================================================================
// Provides a consistent, UI-friendly format for all service ticket descriptions.
// =============================================================================

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
}

/**
 * Format a standard inbound call ticket description.
 */
export function formatInboundCallDescription(params: TicketDescriptionParams): string {
  const lines: string[] = [];

  // --- Service Request Details ---
  lines.push('🛠️ Service Request Details');
  lines.push(params.summary || 'No summary available');
  lines.push('');
  lines.push('');

  // --- Extracted Data ---
  const extractedLines: string[] = [];
  if (params.actionItems && params.actionItems.length > 0) {
    extractedLines.push('Action Items:');
    params.actionItems.forEach(item => extractedLines.push(`• ${item}`));
  }
  if (params.extractedData) {
    const d = params.extractedData;
    if (d.customerName) extractedLines.push(`Customer: ${d.customerName}`);
    if (d.policyNumber) extractedLines.push(`Policy: ${d.policyNumber}`);
    if (d.reason) extractedLines.push(`Reason: ${d.reason}`);
  }
  if (extractedLines.length > 0) {
    lines.push('📊 Extracted Data from Call');
    lines.push(...extractedLines);
    lines.push('');
    lines.push('');
  }

  // --- Call Information ---
  lines.push('📞 Call Information');
  if (params.callerPhone) {
    lines.push(`Phone Number: ${params.callerPhone}`);
    lines.push('');
  }
  if (params.durationSeconds != null) {
    lines.push(`Call Duration: ${params.durationSeconds} seconds`);
    lines.push('');
  }
  if (params.isNCM && params.callerPhone) {
    lines.push('Caller Information: ' + (params.customerName || 'Unknown'));
    lines.push('');
    lines.push(`Phone Number: ${params.callerPhone}`);
    lines.push('');
  }
  lines.push('');

  // --- Transcript ---
  if (params.transcript) {
    lines.push('🗣️ Call Transcription');
    lines.push(cleanTranscript(params.transcript));
    lines.push('');
  }

  return lines.join('\n').trimEnd();
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
  const lines: string[] = [];

  // --- Service Request Details ---
  lines.push('🛠️ Service Request Details');
  lines.push(params.aiSummary || params.reason || 'After-hours call - callback requested');
  lines.push('');
  lines.push('');

  // --- Extracted Data ---
  const extractedLines: string[] = [];
  if (params.reason && params.reason !== params.aiSummary) {
    extractedLines.push(`Reason: ${params.reason}`);
  }
  if (params.actionItems && params.actionItems.length > 0) {
    extractedLines.push('Action Items:');
    params.actionItems.forEach(item => extractedLines.push(`• ${item}`));
  }
  if (extractedLines.length > 0) {
    lines.push('📊 Extracted Data from Call');
    lines.push(...extractedLines);
    lines.push('');
    lines.push('');
  }

  // --- Call Information ---
  lines.push('📞 Call Information');
  if (params.callerName) {
    lines.push(`Caller: ${params.callerName}`);
    lines.push('');
  }
  lines.push(`Phone Number: ${params.callerPhone}`);
  lines.push('');
  if (params.isNCM) {
    lines.push('Caller Information: ' + (params.callerName || 'Unknown'));
    lines.push('');
    lines.push(`Phone Number: ${params.callerPhone}`);
    lines.push('');
  }
  lines.push('');

  // --- Voicemail / ReceptionHQ ---
  if (params.transcript) {
    lines.push('🗣️ Voicemail Transcript');
    lines.push(cleanTranscript(params.transcript));
    lines.push('');
    lines.push('');
  }

  if (params.emailBody && params.emailBody !== params.reason) {
    lines.push('📝 ReceptionHQ Notes');
    lines.push(params.emailBody);
    lines.push('');
    lines.push('');
  }

  return lines.join('\n').trimEnd();
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
  const lines: string[] = [];

  lines.push(`📋 Quote Intake - ${params.typeLabel}`);
  lines.push('');

  // Contact info
  if (params.contact) {
    const c = params.contact;
    const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
    const parts: string[] = [];
    if (name) parts.push(name);
    if (c.phone) parts.push(c.phone);
    if (c.email) parts.push(c.email);
    if (parts.length > 0) lines.push(`Contact: ${parts.join(' | ')}`);
    if (c.address) {
      const addrParts = [c.address.street, c.address.city, c.address.state, c.address.zip].filter(Boolean);
      if (addrParts.length > 0) lines.push(`Address: ${addrParts.join(', ')}`);
    }
    lines.push('');
  }

  // Vehicles
  if (params.vehicles && params.vehicles.length > 0) {
    lines.push('Vehicles:');
    params.vehicles.forEach((v, i) => {
      const desc = [v.year, v.make, v.model].filter(Boolean).join(' ');
      const details: string[] = [];
      if (v.use) details.push(v.use);
      if (v.annualMiles) details.push(`${v.annualMiles.toLocaleString()} mi/yr`);
      lines.push(`  ${i + 1}. ${desc}${details.length ? ` - ${details.join(', ')}` : ''}`);
    });
    lines.push('');
  }

  // Drivers
  if (params.drivers && params.drivers.length > 0) {
    lines.push('Drivers:');
    params.drivers.forEach((d, i) => {
      const name = `${d.firstName || ''} ${d.lastName || ''}`.trim();
      const details: string[] = [];
      if (d.dob) details.push(`DOB: ${d.dob}`);
      if (d.licenseNumber) details.push(`DL# ${d.licenseNumber}`);
      if (d.licenseState) details.push(d.licenseState);
      lines.push(`  ${i + 1}. ${name}${details.length ? ` (${details.join(', ')})` : ''}`);
    });
    lines.push('');
  }

  // Property
  if (params.property) {
    const p = params.property;
    lines.push('Property:');
    if (p.address) {
      if (typeof p.address === 'string') {
        lines.push(`  Address: ${p.address}`);
      } else {
        const parts = [p.address.street, p.address.city, p.address.state, p.address.zip].filter(Boolean);
        if (parts.length) lines.push(`  Address: ${parts.join(', ')}`);
      }
    }
    const propDetails: string[] = [];
    if (p.yearBuilt) propDetails.push(`Built ${p.yearBuilt}`);
    if (p.squareFeet) propDetails.push(`${p.squareFeet.toLocaleString()} sq ft`);
    if (p.constructionType) propDetails.push(p.constructionType);
    if (p.roofType) propDetails.push(`${p.roofType} roof`);
    if (p.roofAge) propDetails.push(`Roof age: ${p.roofAge}yr`);
    if (propDetails.length) lines.push(`  ${propDetails.join(', ')}`);
    lines.push('');
  }

  // Notes
  if (params.notes) {
    lines.push(`Notes: ${params.notes}`);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

/**
 * Strip HTML tags and clean up transcript text for plain-text display.
 * - Removes <p>, </p>, <br />, <br> tags
 * - Collapses repeated filler lines (e.g. repeated "Okay." or "Mm-hmm.")
 * - Trims excessive blank lines
 */
function cleanTranscript(raw: string): string {
  let text = raw;

  // Strip <p> tags → newlines
  text = text.replace(/<p>/gi, '');
  text = text.replace(/<\/p>/gi, '\n');

  // Strip <br /> and <br> tags
  text = text.replace(/<br\s*\/?>/gi, '');

  // Strip any remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Collapse repeated filler lines (3+ identical short lines in a row)
  text = text.replace(/^(.{1,20})\n(\1\n){2,}/gm, '$1\n');

  // Clean up excessive blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}
