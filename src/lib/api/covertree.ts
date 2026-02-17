// CoverTree API Client
// GraphQL client for quoting mobile/manufactured home insurance via CoverTree's AppSync API
// Auth: Cognito REFRESH_TOKEN_AUTH flow (federated OIDC — no username/password)

// =============================================================================
// TYPES
// =============================================================================

export interface CoverTreeConfig {
  refreshToken: string;
  cognitoClientId: string;
  cognitoRegion: string;
  graphqlEndpoint: string;
}

interface CachedToken {
  idToken: string;
  expiresAt: number; // epoch ms
}

export interface CoverTreeOffer {
  quoteLocator: string;
  plan: string; // Silver, Gold, Platinum
  pricing: {
    grossPremium: number;
    totalDue: number;
    fees?: Array<{ name: string; amount: number }>;
    commissions?: Array<{ amount: number; recipient: string }>;
  };
  quote: {
    homeCoverage?: number;
    lossOfUse?: number;
    personalLiability?: number;
    medicalPaymentToOther?: number;
    otherStructures?: number;
    premisesLiability?: number;
    standardDeductible?: number;
    windHailDeductible?: number;
    yourBelongings?: number;
    waterDamage?: number;
    waterDamageDeductible?: number;
  };
  homeCoverageDescription?: string;
  yourBelongingsDescription?: string;
}

export interface CoverTreeQuoteResult {
  policyLocator: string;
  step: string;
  selectedQuoteLocator: string;
  offers: CoverTreeOffer[];
}

export interface CoverTreeExtraCoverage {
  name: string;
  key: string;
  price: number;
  description?: string;
}

export interface CoverTreeDynamicQuestion {
  questionId: string;
  questionText: string;
  answerType: string;
  answerOptions?: string[];
  defaultAnswer?: string;
}

export interface CoverTreePolicy {
  policyLocator: string;
  status: string;
  step: string;
  productTypeName?: string;
  selectedQuoteLocator?: string;
  mainUnitType?: string;
  paymentScheduleName?: string;
  startDate?: string;
  endDate?: string;
  insuredDateOfBirth?: string;
  policyholder?: {
    firstName: string;
    lastName: string;
    emailAddress: string;
    primaryContactNumber?: string;
    policyholderLocator: string;
    mailingAddress?: {
      streetAddress: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
  units?: Array<{
    unitId: string;
    selectedPlan?: string;
    address?: {
      streetAddress: string;
      city: string;
      state: string;
      zipCode: string;
      county?: string;
    };
    construction?: {
      homeType: string;
      manufacturerName: string;
      homeFixtures: string;
      roofShape: string;
      totalSquareFootage: number;
      modelYear: number;
    };
    pricing?: {
      grossPremium: number;
      totalDue: number;
    };
  }>;
  offers?: CoverTreeOffer[];
  selectedQuotePricing?: {
    grossPremium: number;
    totalDue: number;
  };
  documents?: Array<{
    url: string;
    type: string;
    fileName: string;
    displayName: string;
  }>;
  agencyInformation?: {
    agentId: string;
    agentName: string;
    agencyId: string;
    agencyName: string;
  };
  underwritingNotes?: string[];
}

/** Input for CreateOrUpdateBasicPolicyDetailsWithHolder */
export interface CreateQuoteInput {
  effectiveDate: string;
  policyUsage: string; // MainResidence, SecondaryResidence, SeasonalResidence, Landlord, Vacant
  isNewPurchase: boolean;
  purchaseDate: string; // InBuyingProcess, LessThan1Year, 1To3Years, 3To5Years, MoreThan5Years
  priorInsurance: string; // Yes, No
  priorCarrierName?: string;
  priorPolicyExpirationDate?: string;
  policyholder: {
    firstName: string;
    middleName?: string;
    lastName: string;
    emailAddress: string;
    primaryContactNumber: string;
    type: string; // Person
    dateOfBirth: string;
    mailingAddress: {
      streetAddress: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
  unit: {
    address: {
      streetAddress: string;
      city: string;
      state: string;
      zipCode: string;
      county?: string;
      countryCode?: string;
    };
    construction: {
      homeType: string; // SingleWide, DoubleWide, TripleWide, ParkModel, TinyHome, ADU, StationaryTravelTrailer
      manufacturerName: string;
      homeFixtures: string; // Standard, AFewExtras, HighEnd
      roofShape: string; // Gable, Hip, Flat, Gambrel, Mansard, Shed
      totalSquareFootage: number;
      modelYear: number;
      location: string; // OwnLand, MobileHomePark, RentedLand
    };
  };
  underwritingAnswers: {
    burglarAlarm: string; // None, Local, Central
    hasFireHydrantWithin1000Feet: boolean;
    hasFireStationWithin5Miles: boolean;
    hasSmokersInHome: boolean;
    hasTrampolineOnPremises: boolean;
    hasPoolOnPremises: boolean;
    hasAnimalOrPetOnPremises: boolean;
    hasBusinessOnPremises: boolean;
    hasOpenOrKnownCodeViolation: boolean;
    hasUncorrectedFireOrBuildingCodeViolation: boolean;
    isInForeclosure: boolean;
    hasOpenInsuranceClaim: boolean;
    hasAnimalOrPetCausedInjury: boolean;
    hasAnimalOrPetIsRestrictedBreed: boolean;
    hasWoodBurningStove: boolean;
    hasKnobAndTubeWiring: boolean;
    isHitchedOrOnWheels: boolean;
    isInFloodZone: boolean;
    hasAluminumWiring: boolean;
    hasFederalPacificElectricalPanel: boolean;
    hasPolybutylenePiping: boolean;
    hasGalvanizedPlumbing: boolean;
    hasZinscoElectricalPanel: boolean;
    hasSumpPump: boolean;
    hasBackupGenerator: boolean;
  };
}

// =============================================================================
// CLIENT
// =============================================================================

export class CoverTreeClient {
  private config: CoverTreeConfig;
  private cachedToken: CachedToken | null = null;

  constructor(config: CoverTreeConfig) {
    this.config = config;
  }

  // ---------------------------------------------------------------------------
  // Authentication — REFRESH_TOKEN_AUTH flow
  // ---------------------------------------------------------------------------

  private async refreshTokens(): Promise<string> {
    // Return cached token if still valid (5-minute buffer)
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.idToken;
    }

    const url = `https://cognito-idp.${this.config.cognitoRegion}.amazonaws.com/`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: this.config.cognitoClientId,
        AuthParameters: {
          REFRESH_TOKEN: this.config.refreshToken,
        },
      }),
    });

    const data = await response.json();

    if (!data.AuthenticationResult?.IdToken) {
      const msg = data.message || 'Unknown error';
      throw new Error(
        `CoverTree token refresh failed: ${msg}. The refresh token may have expired (30-day lifetime).`
      );
    }

    const expiresIn = data.AuthenticationResult.ExpiresIn || 3600;
    this.cachedToken = {
      idToken: data.AuthenticationResult.IdToken,
      // 5-minute buffer before expiry
      expiresAt: Date.now() + (expiresIn - 300) * 1000,
    };

    return this.cachedToken.idToken;
  }

  // ---------------------------------------------------------------------------
  // GraphQL Request Helper
  // ---------------------------------------------------------------------------

  private async graphqlRequest<T = any>(
    operationName: string,
    query: string,
    variables: Record<string, any> = {}
  ): Promise<T> {
    const token = await this.refreshTokens();

    const response = await fetch(this.config.graphqlEndpoint, {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ operationName, query, variables }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`CoverTree GraphQL error ${response.status}: ${error}`);
    }

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      const messages = result.errors.map((e: any) => e.message).join('; ');
      throw new Error(`CoverTree GraphQL errors: ${messages}`);
    }

    return result.data;
  }

  // ---------------------------------------------------------------------------
  // Quoting Flow
  // ---------------------------------------------------------------------------

  /**
   * Address autocomplete as user types
   */
  async getAutocompleteAddress(search: string): Promise<Array<{
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    county: string;
  }>> {
    const data = await this.graphqlRequest(
      'GetAutocompleteAddress',
      `query GetAutocompleteAddress($search: String!) {
        getAutocompleteAddress(search: $search) {
          streetAddress city state zipCode county
        }
      }`,
      { search }
    );
    return data.getAutocompleteAddress || [];
  }

  /**
   * Geocode an address
   */
  async geoCodeAddress(address: {
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
  }): Promise<{ latitude: number; longitude: number }> {
    const data = await this.graphqlRequest(
      'GeoCodeAddress',
      `query GeoCodeAddress($address: GeoCodeInput!) {
        geoCodeAddress(address: $address) { latitude longitude }
      }`,
      { address }
    );
    return data.geoCodeAddress;
  }

  /**
   * Check if CoverTree can operate in a given state
   */
  async canOperateInState(state: string): Promise<string> {
    const data = await this.graphqlRequest(
      'CanOperateInState',
      `query CanOperateInState($state: String!) {
        canOperateInState(state: $state)
      }`,
      { state }
    );
    return data.canOperateInState; // Returns "Yes" or "No"
  }

  /**
   * Validate an email address
   */
  async validateEmail(emailAddress: string): Promise<boolean> {
    const data = await this.graphqlRequest(
      'ValidateEmail',
      `query ValidateEmail($emailAddress: AWSEmail!) {
        validateEmail(emailAddress: $emailAddress) { isValid }
      }`,
      { emailAddress }
    );
    return data.validateEmail?.isValid ?? false;
  }

  /**
   * Get state-specific dynamic questions
   */
  async getDynamicQuestions(state: string): Promise<CoverTreeDynamicQuestion[]> {
    const data = await this.graphqlRequest(
      'GetDynamicQuestions',
      `query GetDynamicQuestions($state: String!) {
        getDynamicQuestions(state: $state) {
          questionId questionText answerType answerOptions defaultAnswer
        }
      }`,
      { state }
    );
    return data.getDynamicQuestions || [];
  }

  /**
   * Search manufacturers for autocomplete
   * Note: Uses the getParameters resolver with type=Manufacturer
   */
  async getManufacturers(search: string): Promise<Array<{ value: string }>> {
    const data = await this.graphqlRequest(
      'GetManufacturers',
      `query GetManufacturers($search: String!) {
        getParameters(type: Manufacturer, search: $search) { value }
      }`,
      { search }
    );
    return data.getParameters || [];
  }

  /**
   * Core quote creation — CreateOrUpdateBasicPolicyDetailsWithHolder
   * Accepts all property details, policyholder info, and UW answers in one call.
   * Returns three plan offers (Silver, Gold, Platinum) with pricing.
   */
  async createQuote(
    input: CreateQuoteInput,
    policyLocator?: string
  ): Promise<CoverTreeQuoteResult> {
    const data = await this.graphqlRequest(
      'CreateOrUpdateBasicPolicyDetailsWithHolder',
      `mutation CreateOrUpdateBasicPolicyDetailsWithHolder($policyLocator: ID, $input: CreateOrUpdatePolicyInput!) {
        createOrUpdateBasicPolicyDetailsWithHolder(policyLocator: $policyLocator, input: $input) {
          policyLocator step selectedQuoteLocator
          offers {
            quoteLocator plan
            pricing { grossPremium totalDue fees { name amount } commissions { amount recipient } }
            quote { homeCoverage lossOfUse personalLiability medicalPaymentToOther otherStructures premisesLiability standardDeductible windHailDeductible yourBelongings waterDamage waterDamageDeductible }
            homeCoverageDescription yourBelongingsDescription
          }
        }
      }`,
      { policyLocator: policyLocator || null, input }
    );
    return data.createOrUpdateBasicPolicyDetailsWithHolder;
  }

  /**
   * Select a plan tier (Silver, Gold, or Platinum) after quotes are generated
   */
  async selectQuote(
    policyLocator: string,
    quoteLocator: string
  ): Promise<{ policyLocator: string; step: string; selectedQuoteLocator: string }> {
    const data = await this.graphqlRequest(
      'SelectQuote',
      `mutation SelectQuote($policyLocator: ID!, $quoteLocator: ID!) {
        selectQuote(policyLocator: $policyLocator, quoteLocator: $quoteLocator) {
          policyLocator step selectedQuoteLocator
        }
      }`,
      { policyLocator, quoteLocator }
    );
    return data.selectQuote;
  }

  /**
   * Get extra coverage prices for a policy
   */
  async getExtraCoveragePrices(policyLocator: string): Promise<CoverTreeExtraCoverage[]> {
    const data = await this.graphqlRequest(
      'GetExtraCoveragesPrices',
      `query GetExtraCoveragesPrices($policyLocator: ID!) {
        getExtraCoveragesPrices(policyLocator: $policyLocator) {
          name key price description
        }
      }`,
      { policyLocator }
    );
    return data.getExtraCoveragesPrices || [];
  }

  /**
   * Save extra/optional coverages
   */
  async saveExtraCoverages(
    policyLocator: string,
    input: Record<string, any>
  ): Promise<{ policyLocator: string; step: string }> {
    const data = await this.graphqlRequest(
      'SaveExtraCoverages',
      `mutation SaveExtraCoverages($policyLocator: ID!, $input: SaveExtraCoveragesInput!) {
        saveExtraCoverages(policyLocator: $policyLocator, input: $input) {
          policyLocator step
        }
      }`,
      { policyLocator, input }
    );
    return data.saveExtraCoverages;
  }

  /**
   * Update underwriting answers after initial submission
   */
  async updateUnderwritingAnswers(
    policyLocator: string,
    input: Record<string, any>
  ): Promise<{ policyLocator: string; step: string }> {
    const data = await this.graphqlRequest(
      'UpdateUnderwritingAnswers',
      `mutation UpdateUnderwritingAnswers($policyLocator: ID!, $input: UpdateUnderwritingAnswersInput!) {
        updateUnderwritingAnswers(policyLocator: $policyLocator, input: $input) {
          policyLocator step
        }
      }`,
      { policyLocator, input }
    );
    return data.updateUnderwritingAnswers;
  }

  /**
   * Run prior claims check for the property
   */
  async checkAndAddPriorClaim(
    policyLocator: string,
    address: { streetAddress: string; city: string; state: string; zipCode: string }
  ): Promise<{ policyLocator: string; step: string }> {
    const data = await this.graphqlRequest(
      'CheckAndAddPriorClaim',
      `mutation CheckAndAddPriorClaim($policyLocator: ID!, $address: PriorClaimAddressInput!) {
        checkAndAddPriorClaim(policyLocator: $policyLocator, address: $address) {
          policyLocator step
        }
      }`,
      { policyLocator, address }
    );
    return data.checkAndAddPriorClaim;
  }

  // ---------------------------------------------------------------------------
  // Policy Retrieval
  // ---------------------------------------------------------------------------

  /**
   * Get full policy details
   */
  async getPolicy(policyLocator: string): Promise<CoverTreePolicy> {
    const data = await this.graphqlRequest(
      'GetPolicy',
      `query GetPolicy($policyLocator: ID!) {
        getPolicy(policyLocator: $policyLocator) {
          policyLocator status step productTypeName selectedQuoteLocator mainUnitType paymentScheduleName startDate endDate insuredDateOfBirth isEsigned
          policyholder { firstName lastName middleName emailAddress primaryContactNumber policyholderLocator type mailingAddress { streetAddress city zipCode state county } }
          priorInsuranceDetails { priorInsurance priorCarrierName priorPolicyExpirationDate }
          units { unitId exposureLocator selectedPlan address { streetAddress city zipCode state county } construction { homeType manufacturerName homeFixtures roofShape totalSquareFootage modelYear } pricing { grossPremium totalDue fees { name amount } } }
          offers { quoteLocator plan pricing { grossPremium totalDue fees { name amount } } quote { homeCoverage lossOfUse personalLiability medicalPaymentToOther otherStructures premisesLiability standardDeductible windHailDeductible yourBelongings waterDamageDeductible waterDamage } homeCoverageDescription yourBelongingsDescription }
          selectedQuotePricing { grossPremium totalDue fees { name amount } }
          documents { url type fileName documentLocator displayName createdTimestamp }
          agencyInformation { agentId agencyName agencyId agentName }
          underwritingNotes
        }
      }`,
      { policyLocator }
    );
    return data.getPolicy;
  }

  /**
   * Search policies by name, address, or policy number
   */
  async search(query: string): Promise<Array<{
    policyLocator: string;
    status: string;
    productTypeName: string | null;
  }>> {
    const data = await this.graphqlRequest(
      'Search',
      `query Search($query: String!) {
        search(query: $query) { policyLocator status productTypeName }
      }`,
      { query }
    );
    return data.search || [];
  }

  /**
   * Get quote documents (binder, application, proposal)
   */
  async getQuoteDocuments(
    policyLocator: string,
    paymentSchedule: 'FullPay' | 'MonthlyPay' = 'FullPay'
  ): Promise<{
    binderDocumentUrl: string;
    applicationDocumentUrl: string;
    quoteProposalUrl: string;
  }> {
    const data = await this.graphqlRequest(
      'GetQuoteDocuments',
      `query GetQuoteDocuments($policyLocator: ID!, $paymentSchedule: PaymentSchedule!) {
        getQuoteDocuments(policyLocator: $policyLocator, paymentSchedule: $paymentSchedule) {
          binderDocumentUrl applicationDocumentUrl quoteProposalUrl
        }
      }`,
      { policyLocator, paymentSchedule }
    );
    return data.getQuoteDocuments;
  }

  /**
   * Get overview metrics for the agency dashboard
   */
  async getOverviewMetrics(): Promise<{
    quotesAmount: number;
    policiesAmount: number;
    premium: number;
    quoteToBindRatioPercent: number;
  }> {
    const data = await this.graphqlRequest(
      'GetOverviewMetrics',
      `query GetOverviewMetrics {
        getOverviewMetrics { metrics { quotesAmount policiesAmount premium quoteToBindRatioPercent } }
      }`
    );
    return data.getOverviewMetrics?.metrics;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let coverTreeClient: CoverTreeClient | null = null;

export function getCoverTreeClient(): CoverTreeClient {
  if (!coverTreeClient) {
    const refreshToken = process.env.COVERTREE_REFRESH_TOKEN;
    const cognitoClientId = process.env.COVERTREE_COGNITO_CLIENT_ID || 't8fv2i5uq3teuc0vjjb0pcqf9';
    const cognitoRegion = process.env.COVERTREE_COGNITO_REGION || 'us-east-1';
    const graphqlEndpoint = process.env.COVERTREE_GRAPHQL_ENDPOINT ||
      'https://fjyrjhbjiffbteohp5y75vt6qm.appsync-api.us-east-1.amazonaws.com/graphql';

    if (!refreshToken) {
      throw new Error(
        'CoverTree refresh token not configured. Set COVERTREE_REFRESH_TOKEN environment variable. ' +
        'This token is obtained from the CoverTree/First Connect portal and lasts ~30 days.'
      );
    }

    coverTreeClient = new CoverTreeClient({
      refreshToken,
      cognitoClientId,
      cognitoRegion,
      graphqlEndpoint,
    });
  }

  return coverTreeClient;
}
