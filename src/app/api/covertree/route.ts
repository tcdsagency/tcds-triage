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
      case 'getAutocompleteAddresses': {
        const { searchText } = params;
        if (!searchText) {
          return NextResponse.json({ success: true, addresses: [] });
        }
        const addresses = await client.getAutocompleteAddresses(searchText);
        return NextResponse.json({ success: true, addresses });
      }

      case 'canOperateInState': {
        const { state } = params;
        if (!state) {
          return NextResponse.json({ success: false, error: 'Missing state' }, { status: 400 });
        }
        const result = await client.canOperateInState(state);
        return NextResponse.json({ success: true, canOperate: result === 'Yes' });
      }

      case 'validateEmail': {
        const { email } = params;
        if (!email) {
          return NextResponse.json({ success: false, error: 'Missing email' }, { status: 400 });
        }
        const deliverability = await client.validateEmail(email);
        return NextResponse.json({ success: true, deliverability });
      }

      case 'getDynamicQuestions': {
        const { state, policyUsage, effectiveDate } = params;
        if (!state || !policyUsage || !effectiveDate) {
          return NextResponse.json({ success: false, error: 'Missing state, policyUsage, or effectiveDate' }, { status: 400 });
        }
        const questions = await client.getDynamicQuestions(state, policyUsage, effectiveDate);
        return NextResponse.json({ success: true, questions });
      }

      case 'getManufacturers': {
        const { search } = params;
        if (!search) {
          return NextResponse.json({ success: true, manufacturers: [] });
        }
        const manufacturers = await client.getManufacturers(search);
        return NextResponse.json({ success: true, manufacturers });
      }

      case 'createQuote': {
        const { policyholderInput, policyInput } = params;
        if (!policyholderInput || !policyInput) {
          return NextResponse.json(
            { success: false, error: 'Missing policyholderInput or policyInput' },
            { status: 400 }
          );
        }
        const result = await client.createQuote({ policyholderInput, policyInput });
        return NextResponse.json({ success: true, result });
      }

      case 'selectQuote': {
        const { policyLocator, quoteLocator } = params;
        if (!policyLocator || !quoteLocator) {
          return NextResponse.json(
            { success: false, error: 'Missing policyLocator or quoteLocator' },
            { status: 400 }
          );
        }
        const result = await client.selectQuote(policyLocator, quoteLocator);
        return NextResponse.json({ success: true, result });
      }

      case 'getExtraCoveragePrices': {
        const { policyLocator } = params;
        if (!policyLocator) {
          return NextResponse.json({ success: false, error: 'Missing policyLocator' }, { status: 400 });
        }
        const prices = await client.getExtraCoveragePrices(policyLocator);
        return NextResponse.json({ success: true, prices });
      }

      case 'saveExtraCoverages': {
        const { policyLocator, policyLevelExtraCoverages, unitLevelExtraCoverages } = params;
        if (!policyLocator) {
          return NextResponse.json({ success: false, error: 'Missing policyLocator' }, { status: 400 });
        }
        const result = await client.saveExtraCoverages(
          policyLocator,
          policyLevelExtraCoverages || {},
          unitLevelExtraCoverages || []
        );
        return NextResponse.json({ success: true, result });
      }

      case 'updateUnderwritingAnswers': {
        const { policyLocator, policyLevelUW, unitLevelUW } = params;
        if (!policyLocator) {
          return NextResponse.json({ success: false, error: 'Missing policyLocator' }, { status: 400 });
        }
        const result = await client.updateUnderwritingAnswers(
          policyLocator,
          policyLevelUW || {},
          unitLevelUW || []
        );
        return NextResponse.json({ success: true, result });
      }

      case 'checkAndAddPriorClaim': {
        const { policyLocator, address } = params;
        if (!policyLocator || !address) {
          return NextResponse.json(
            { success: false, error: 'Missing policyLocator or address' },
            { status: 400 }
          );
        }
        const result = await client.checkAndAddPriorClaim(policyLocator, address);
        return NextResponse.json({ success: true, result });
      }

      case 'fetchUWDecision': {
        const { policyLocator } = params;
        if (!policyLocator) {
          return NextResponse.json({ success: false, error: 'Missing policyLocator' }, { status: 400 });
        }
        const decision = await client.fetchUWDecisionAndGeneratePaymentPlans(policyLocator);
        return NextResponse.json({ success: true, decision });
      }

      case 'initiatePurchase': {
        const { policyLocator, paymentSchedule, signResponsibilityChecked, lenderDetails, additionalInterests } = params;
        if (!policyLocator || !paymentSchedule) {
          return NextResponse.json({ success: false, error: 'Missing policyLocator or paymentSchedule' }, { status: 400 });
        }
        const result = await client.initiatePolicyPurchase(
          policyLocator, paymentSchedule, signResponsibilityChecked, lenderDetails, additionalInterests
        );
        return NextResponse.json({ success: true, result });
      }

      case 'getPolicy': {
        const { policyLocator } = params;
        if (!policyLocator) {
          return NextResponse.json({ success: false, error: 'Missing policyLocator' }, { status: 400 });
        }
        const policy = await client.getPolicy(policyLocator);
        return NextResponse.json({ success: true, policy });
      }

      case 'getQuoteDocuments': {
        const { policyLocator, paymentSchedule } = params;
        if (!policyLocator) {
          return NextResponse.json({ success: false, error: 'Missing policyLocator' }, { status: 400 });
        }
        const documents = await client.getQuoteDocuments(policyLocator, paymentSchedule || 'FullPay');
        return NextResponse.json({ success: true, documents });
      }

      case 'search': {
        const { query } = params;
        if (!query) {
          return NextResponse.json({ success: true, results: [] });
        }
        const results = await client.search(query);
        return NextResponse.json({ success: true, results });
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
