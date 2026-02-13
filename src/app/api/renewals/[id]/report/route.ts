/**
 * GET /api/renewals/[id]/report
 * Generate Renewal Review Report PDF.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { renewalComparisons, customers, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { buildRenewalReportDefinition } from '@/lib/renewal/pdf-report';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [renewal] = await db
      .select()
      .from(renewalComparisons)
      .where(eq(renewalComparisons.id, id))
      .limit(1);

    if (!renewal) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    // Get customer name (with insuredName fallback)
    let customerName = (renewal.renewalSnapshot as Record<string, any> | null)?.insuredName || 'Unknown Customer';
    if (renewal.customerId) {
      const [customer] = await db
        .select({ firstName: customers.firstName, lastName: customers.lastName })
        .from(customers)
        .where(eq(customers.id, renewal.customerId))
        .limit(1);
      if (customer) {
        customerName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Unknown Customer';
      }
    }

    // Get agent name
    let agentName = 'N/A';
    if (renewal.agentDecisionBy) {
      const [user] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, renewal.agentDecisionBy))
        .limit(1);
      if (user) {
        agentName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'N/A';
      }
    }

    const docDefinition = buildRenewalReportDefinition(
      {
        ...renewal,
        currentPremium: renewal.currentPremium ? parseFloat(renewal.currentPremium) : null,
        renewalPremium: renewal.renewalPremium ? parseFloat(renewal.renewalPremium) : null,
        premiumChangeAmount: renewal.premiumChangeAmount ? parseFloat(renewal.premiumChangeAmount) : null,
        premiumChangePercent: renewal.premiumChangePercent ? parseFloat(renewal.premiumChangePercent) : null,
        customerName,
      },
      agentName
    );

    // Generate actual PDF binary using pdfmake
    const PdfPrinter = (await import('pdfmake')).default;
    const printer = new PdfPrinter({
      Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    });
    const pdfDoc = printer.createPdfKitDocument(docDefinition as any);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve());
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
    const pdfBuffer = Buffer.concat(chunks);

    const fileName = `renewal-report-${renewal.policyNumber || id}.pdf`;
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('[API] Error generating report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
