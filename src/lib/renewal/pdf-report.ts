/**
 * Renewal Review PDF Report
 * =========================
 * Builds a pdfmake document definition for a Renewal Review Report.
 */

import type { MaterialChange } from '@/types/renewal.types';

interface RenewalForReport {
  policyNumber: string | null;
  carrierName: string | null;
  lineOfBusiness: string | null;
  renewalEffectiveDate: Date | string;
  currentPremium: number | null;
  renewalPremium: number | null;
  premiumChangeAmount: number | null;
  premiumChangePercent: number | null;
  recommendation: string | null;
  agentDecision: string | null;
  agentNotes: string | null;
  agentDecisionAt: Date | string | null;
  materialChanges: MaterialChange[] | any;
  comparisonSummary: any;
  customerName: string;
}

/**
 * Build a pdfmake document definition for the renewal report.
 * Client-side will use pdfmake to render to PDF.
 */
export function buildRenewalReportDefinition(
  renewal: RenewalForReport,
  agentName: string
): Record<string, any> {
  const formatCurrency = (val: number | null) =>
    val != null ? `$${val.toFixed(2)}` : 'N/A';

  const formatPercent = (val: number | null) =>
    val != null ? `${val > 0 ? '+' : ''}${val.toFixed(1)}%` : 'N/A';

  const formatDate = (val: Date | string | null) => {
    if (!val) return 'N/A';
    const d = new Date(val);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const materialChanges = Array.isArray(renewal.materialChanges) ? renewal.materialChanges : [];
  const negativeChanges = materialChanges.filter((c: MaterialChange) => c.severity === 'material_negative');
  const positiveChanges = materialChanges.filter((c: MaterialChange) => c.severity === 'material_positive');

  return {
    content: [
      // Header
      {
        text: 'TCDS Renewal Review Report',
        style: 'header',
        margin: [0, 0, 0, 5],
      },
      {
        text: `Generated: ${new Date().toLocaleDateString('en-US')}`,
        style: 'subheader',
        margin: [0, 0, 0, 15],
      },

      // Customer Info
      {
        text: 'Customer Information',
        style: 'sectionHeader',
        margin: [0, 0, 0, 5],
      },
      {
        columns: [
          { text: `Customer: ${renewal.customerName}`, width: '50%' },
          { text: `Agent: ${agentName}`, width: '50%' },
        ],
        margin: [0, 0, 0, 3],
      },
      {
        columns: [
          { text: `Policy: ${renewal.policyNumber || 'N/A'}`, width: '50%' },
          { text: `Carrier: ${renewal.carrierName || 'N/A'}`, width: '50%' },
        ],
        margin: [0, 0, 0, 3],
      },
      {
        columns: [
          { text: `LOB: ${renewal.lineOfBusiness || 'N/A'}`, width: '50%' },
          { text: `Effective: ${formatDate(renewal.renewalEffectiveDate)}`, width: '50%' },
        ],
        margin: [0, 0, 0, 15],
      },

      // Premium Comparison
      {
        text: 'Premium Comparison',
        style: 'sectionHeader',
        margin: [0, 0, 0, 5],
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', '*', '*'],
          body: [
            [
              { text: 'Current Premium', bold: true },
              { text: 'Renewal Premium', bold: true },
              { text: 'Change', bold: true },
            ],
            [
              formatCurrency(renewal.currentPremium),
              formatCurrency(renewal.renewalPremium),
              `${formatCurrency(renewal.premiumChangeAmount)} (${formatPercent(renewal.premiumChangePercent)})`,
            ],
          ],
        },
        margin: [0, 0, 0, 15],
      },

      // Recommendation
      {
        text: 'System Recommendation',
        style: 'sectionHeader',
        margin: [0, 0, 0, 5],
      },
      {
        text: (renewal.recommendation || 'N/A').replace(/_/g, ' ').toUpperCase(),
        bold: true,
        margin: [0, 0, 0, 15],
      },

      // Material Changes
      ...(negativeChanges.length > 0
        ? [
            {
              text: `Material Concerns (${negativeChanges.length})`,
              style: 'sectionHeader',
              margin: [0, 0, 0, 5],
            },
            {
              ul: negativeChanges.map((c: MaterialChange) => c.description),
              margin: [0, 0, 0, 15],
            },
          ]
        : []),

      ...(positiveChanges.length > 0
        ? [
            {
              text: `Positive Changes (${positiveChanges.length})`,
              style: 'sectionHeader',
              margin: [0, 0, 0, 5],
            },
            {
              ul: positiveChanges.map((c: MaterialChange) => c.description),
              margin: [0, 0, 0, 15],
            },
          ]
        : []),

      // Agent Decision
      ...(renewal.agentDecision
        ? [
            {
              text: 'Agent Decision',
              style: 'sectionHeader',
              margin: [0, 0, 0, 5],
            },
            {
              text: `Decision: ${(renewal.agentDecision || '').replace(/_/g, ' ').toUpperCase()}`,
              bold: true,
              margin: [0, 0, 0, 3],
            },
            ...(renewal.agentNotes
              ? [{ text: `Notes: ${renewal.agentNotes}`, margin: [0, 0, 0, 3] }]
              : []),
            {
              text: `Decided: ${formatDate(renewal.agentDecisionAt)} by ${agentName}`,
              italics: true,
              margin: [0, 0, 0, 15],
            },
          ]
        : []),
    ],
    styles: {
      header: { fontSize: 18, bold: true },
      subheader: { fontSize: 10, color: '#666' },
      sectionHeader: { fontSize: 13, bold: true, color: '#333' },
    },
    defaultStyle: { fontSize: 10 },
  };
}
