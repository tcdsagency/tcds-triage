import { NextRequest, NextResponse } from 'next/server';
import { getCoverTreeClient } from '@/lib/api/covertree';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: action' },
        { status: 400 }
      );
    }

    const client = getCoverTreeClient();

    switch (action) {
      case 'canOperateInState': {
        const { state } = params;
        if (!state) {
          return NextResponse.json({ success: false, error: 'Missing state' }, { status: 400 });
        }
        const canOperate = await client.canOperateInState(state);
        return NextResponse.json({ success: true, canOperate });
      }

      case 'getDynamicQuestions': {
        const { state, effectiveDate, policyUsage } = params;
        if (!state || !effectiveDate || !policyUsage) {
          return NextResponse.json(
            { success: false, error: 'Missing state, effectiveDate, or policyUsage' },
            { status: 400 }
          );
        }
        const questions = await client.getDynamicQuestions(state, effectiveDate, policyUsage);
        return NextResponse.json({ success: true, questions });
      }

      case 'createQuote': {
        const { policyInput, policyholderInput } = params;
        if (!policyInput || !policyholderInput) {
          return NextResponse.json(
            { success: false, error: 'Missing policyInput or policyholderInput' },
            { status: 400 }
          );
        }
        const result = await client.createQuote(policyInput, policyholderInput);
        return NextResponse.json({ success: true, ...result });
      }

      case 'selectPlan': {
        const { quoteLocator } = params;
        if (!quoteLocator) {
          return NextResponse.json({ success: false, error: 'Missing quoteLocator' }, { status: 400 });
        }
        const result = await client.selectPlan(quoteLocator);
        return NextResponse.json({ success: true, ...result });
      }

      case 'saveExtraCoverages': {
        const { policyLocator, policyLevel, unitLevel } = params;
        if (!policyLocator) {
          return NextResponse.json({ success: false, error: 'Missing policyLocator' }, { status: 400 });
        }
        await client.saveExtraCoverages(
          policyLocator,
          policyLevel || {},
          unitLevel || {}
        );
        return NextResponse.json({ success: true });
      }

      case 'updateUnderwritingAnswers': {
        const { policyLocator, policyLevelUW, unitLevelUW } = params;
        if (!policyLocator) {
          return NextResponse.json({ success: false, error: 'Missing policyLocator' }, { status: 400 });
        }
        await client.updateUnderwritingAnswers(
          policyLocator,
          policyLevelUW || {},
          unitLevelUW || {}
        );
        return NextResponse.json({ success: true });
      }

      case 'checkPriorClaims': {
        const { policyLocator } = params;
        if (!policyLocator) {
          return NextResponse.json({ success: false, error: 'Missing policyLocator' }, { status: 400 });
        }
        const claimsResult = await client.checkPriorClaims(policyLocator);
        return NextResponse.json({
          success: true,
          hasClaims: claimsResult.hasClaims,
          canBind: claimsResult.canBind,
          message: claimsResult.message,
        });
      }

      case 'initiatePurchase': {
        const { policyLocator } = params;
        if (!policyLocator) {
          return NextResponse.json({ success: false, error: 'Missing policyLocator' }, { status: 400 });
        }
        const purchaseResult = await client.initiatePurchase(policyLocator);
        return NextResponse.json({
          success: true,
          policyNumber: purchaseResult.policyNumber,
          message: purchaseResult.message,
        });
      }

      case 'getManufacturers': {
        const { search } = params;
        if (!search) {
          return NextResponse.json({ success: true, manufacturers: [] });
        }
        const manufacturers = await client.getManufacturers(search);
        return NextResponse.json({ success: true, manufacturers });
      }

      case 'getExtraCoveragePrices': {
        const { policyLocator } = params;
        if (!policyLocator) {
          return NextResponse.json({ success: false, error: 'Missing policyLocator' }, { status: 400 });
        }
        const coverages = await client.getExtraCoveragePrices(policyLocator);
        return NextResponse.json({ success: true, coverages });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[CoverTree] API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'CoverTree API request failed' },
      { status: 500 }
    );
  }
}
