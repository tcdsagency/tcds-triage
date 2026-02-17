// CoverTree API Client
// GraphQL client for quoting mobile/manufactured home insurance via CoverTree's AppSync API

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';

// =============================================================================
// TYPES
// =============================================================================

export interface CoverTreeConfig {
  cognitoUsername: string;
  cognitoPassword: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  graphqlEndpoint: string;
}

interface CachedToken {
  idToken: string;
  expiresAt: number; // epoch ms
}

export interface CoverTreePlan {
  locator: string;
  name: string; // Silver, Gold, Platinum
  premium: number;
  coverages: CoverTreeCoverage[];
}

export interface CoverTreeCoverage {
  name: string;
  limit?: number;
  deductible?: number;
  premium?: number;
}

export interface CoverTreeExtraCoverage {
  name: string;
  key: string;
  price: number;
  description?: string;
}

export interface CoverTreeQuoteResult {
  quoteLocator: string;
  policyLocator: string;
  plans: CoverTreePlan[];
}

export interface CoverTreeManufacturer {
  id: string;
  name: string;
}

export interface CoverTreeDynamicQuestion {
  key: string;
  label: string;
  type: string;
  options?: string[];
  required?: boolean;
}

export interface PolicyInput {
  effectiveDate: string;
  state: string;
  policyUsage: string; // Owner, Landlord, Tenant
  propertyAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  homeType: string; // SingleWide, DoubleWide, TripleWide
  manufacturer: string;
  modelYear: number;
  totalSquareFootage: number;
  roofShape: string;
  roofYear: number;
  homeFixtures: string;
  location: string;
  purchaseDate: string;
  priorInsurance: boolean;
}

export interface PolicyholderInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  mailingAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
}

// =============================================================================
// CLIENT
// =============================================================================

export class CoverTreeClient {
  private config: CoverTreeConfig;
  private cognitoClient: CognitoIdentityProviderClient;
  private cachedToken: CachedToken | null = null;

  constructor(config: CoverTreeConfig) {
    this.config = config;
    // Extract region from user pool ID (e.g., us-east-1_lSBEsBjKs -> us-east-1)
    const region = config.cognitoUserPoolId.split('_')[0];
    this.cognitoClient = new CognitoIdentityProviderClient({ region });
  }

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  private async authenticateWithCognito(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.idToken;
    }

    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: this.config.cognitoClientId,
      AuthParameters: {
        USERNAME: this.config.cognitoUsername,
        PASSWORD: this.config.cognitoPassword,
      },
    });

    const response = await this.cognitoClient.send(command);

    if (!response.AuthenticationResult?.IdToken) {
      throw new Error('CoverTree Cognito auth failed: no IdToken returned');
    }

    const expiresIn = response.AuthenticationResult.ExpiresIn || 3600;
    this.cachedToken = {
      idToken: response.AuthenticationResult.IdToken,
      expiresAt: Date.now() + expiresIn * 1000,
    };

    return this.cachedToken.idToken;
  }

  // ---------------------------------------------------------------------------
  // GraphQL Request Helper
  // ---------------------------------------------------------------------------

  private async graphqlRequest<T = any>(
    query: string,
    variables: Record<string, any> = {}
  ): Promise<T> {
    const token = await this.authenticateWithCognito();

    const response = await fetch(this.config.graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
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
  // Public Methods
  // ---------------------------------------------------------------------------

  /**
   * Check if CoverTree can operate in a given state
   */
  async canOperateInState(state: string): Promise<boolean> {
    const data = await this.graphqlRequest<any>(
      `query CanOperateInState($state: String!) {
        canOperateInState(state: $state) {
          canOperate
          message
        }
      }`,
      { state }
    );
    return data.canOperateInState?.canOperate ?? false;
  }

  /**
   * Get dynamic questions for a state/effectiveDate/policyUsage combo
   */
  async getDynamicQuestions(
    state: string,
    effectiveDate: string,
    policyUsage: string
  ): Promise<CoverTreeDynamicQuestion[]> {
    const data = await this.graphqlRequest<any>(
      `query GetDynamicQuestions($state: String!, $effectiveDate: String!, $policyUsage: String!) {
        getDynamicQuestions(state: $state, effectiveDate: $effectiveDate, policyUsage: $policyUsage) {
          key
          label
          type
          options
          required
        }
      }`,
      { state, effectiveDate, policyUsage }
    );
    return data.getDynamicQuestions || [];
  }

  /**
   * Step 2: Create a quote with policy and policyholder info
   */
  async createQuote(
    policyInput: PolicyInput,
    policyholderInput: PolicyholderInput
  ): Promise<CoverTreeQuoteResult> {
    const data = await this.graphqlRequest<any>(
      `mutation CreateQuote($policyInput: PolicyInput!, $policyholderInput: PolicyholderInput!) {
        createQuote(policyInput: $policyInput, policyholderInput: $policyholderInput) {
          quoteLocator
          policyLocator
          plans {
            locator
            name
            premium
            coverages {
              name
              limit
              deductible
              premium
            }
          }
        }
      }`,
      { policyInput, policyholderInput }
    );
    return data.createQuote;
  }

  /**
   * Step 3: Select a plan from the returned options
   */
  async selectPlan(quoteLocator: string): Promise<{ policyLocator: string; selectedPlan: string }> {
    const data = await this.graphqlRequest<any>(
      `mutation SelectPlan($quoteLocator: String!) {
        selectPlan(quoteLocator: $quoteLocator) {
          policyLocator
          selectedPlan
        }
      }`,
      { quoteLocator }
    );
    return data.selectPlan;
  }

  /**
   * Step 4: Save extra/optional coverages
   */
  async saveExtraCoverages(
    policyLocator: string,
    policyLevel: Record<string, boolean>,
    unitLevel: Record<string, boolean>
  ): Promise<{ success: boolean }> {
    const data = await this.graphqlRequest<any>(
      `mutation SaveExtraCoverages($policyLocator: String!, $policyLevel: AWSJSON!, $unitLevel: AWSJSON!) {
        saveExtraCoverages(policyLocator: $policyLocator, policyLevel: $policyLevel, unitLevel: $unitLevel) {
          success
        }
      }`,
      {
        policyLocator,
        policyLevel: JSON.stringify(policyLevel),
        unitLevel: JSON.stringify(unitLevel),
      }
    );
    return data.saveExtraCoverages;
  }

  /**
   * Step 5: Update underwriting answers
   */
  async updateUnderwritingAnswers(
    policyLocator: string,
    policyLevelUW: Record<string, boolean>,
    unitLevelUW: Record<string, boolean>
  ): Promise<{ success: boolean }> {
    const data = await this.graphqlRequest<any>(
      `mutation UpdateUnderwritingAnswers($policyLocator: String!, $policyLevelUW: AWSJSON!, $unitLevelUW: AWSJSON!) {
        updateUnderwritingAnswers(policyLocator: $policyLocator, policyLevelUW: $policyLevelUW, unitLevelUW: $unitLevelUW) {
          success
        }
      }`,
      {
        policyLocator,
        policyLevelUW: JSON.stringify(policyLevelUW),
        unitLevelUW: JSON.stringify(unitLevelUW),
      }
    );
    return data.updateUnderwritingAnswers;
  }

  /**
   * Step 6a: Check prior claims before binding
   */
  async checkPriorClaims(policyLocator: string): Promise<{ hasClaims: boolean; canBind: boolean; message?: string }> {
    const data = await this.graphqlRequest<any>(
      `mutation CheckPriorClaims($policyLocator: String!) {
        checkPriorClaims(policyLocator: $policyLocator) {
          hasClaims
          canBind
          message
        }
      }`,
      { policyLocator }
    );
    return data.checkPriorClaims;
  }

  /**
   * Step 6b: Initiate purchase (bind policy)
   */
  async initiatePurchase(policyLocator: string): Promise<{
    success: boolean;
    policyNumber?: string;
    message?: string;
  }> {
    const data = await this.graphqlRequest<any>(
      `mutation InitiatePurchase($policyLocator: String!) {
        initiatePurchase(policyLocator: $policyLocator) {
          success
          policyNumber
          message
        }
      }`,
      { policyLocator }
    );
    return data.initiatePurchase;
  }

  /**
   * Search manufacturers for autocomplete
   */
  async getManufacturers(search: string): Promise<CoverTreeManufacturer[]> {
    const data = await this.graphqlRequest<any>(
      `query GetManufacturers($search: String!) {
        getManufacturers(search: $search) {
          id
          name
        }
      }`,
      { search }
    );
    return data.getManufacturers || [];
  }

  /**
   * Get extra coverage prices for a policy
   */
  async getExtraCoveragePrices(policyLocator: string): Promise<CoverTreeExtraCoverage[]> {
    const data = await this.graphqlRequest<any>(
      `query GetExtraCoveragePrices($policyLocator: String!) {
        getExtraCoveragePrices(policyLocator: $policyLocator) {
          name
          key
          price
          description
        }
      }`,
      { policyLocator }
    );
    return data.getExtraCoveragePrices || [];
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let coverTreeClient: CoverTreeClient | null = null;

export function getCoverTreeClient(): CoverTreeClient {
  if (!coverTreeClient) {
    const cognitoUsername = process.env.COVERTREE_COGNITO_USERNAME;
    const cognitoPassword = process.env.COVERTREE_COGNITO_PASSWORD;
    const cognitoUserPoolId = process.env.COVERTREE_COGNITO_USER_POOL_ID;
    const cognitoClientId = process.env.COVERTREE_COGNITO_CLIENT_ID;
    const graphqlEndpoint = process.env.COVERTREE_GRAPHQL_ENDPOINT;

    if (!cognitoUsername || !cognitoPassword || !cognitoUserPoolId || !cognitoClientId || !graphqlEndpoint) {
      throw new Error('CoverTree credentials not configured. Check COVERTREE_* environment variables.');
    }

    coverTreeClient = new CoverTreeClient({
      cognitoUsername,
      cognitoPassword,
      cognitoUserPoolId,
      cognitoClientId,
      graphqlEndpoint,
    });
  }

  return coverTreeClient;
}
