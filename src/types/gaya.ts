// Gaya API Types
// https://live.api.gaya.ai

// =============================================================================
// CORE ENTITY TYPES
// =============================================================================

export interface GayaField {
  name: string;
  value: string;
}

export interface GayaEntity {
  entity: string;
  index: number;
  fields: GayaField[];
}

export type GayaIndustry = 'personal_line_insurance';

// =============================================================================
// REQUEST TYPES
// =============================================================================

export interface GayaClipboardRequest {
  industry: GayaIndustry;
  entities: GayaEntity[];
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

export interface GayaClipboardResponse {
  id: string;
  industry: GayaIndustry;
  entities: GayaEntity[];
  created_at?: string;
}

export interface GayaCreateResponse {
  success: boolean;
  record?: GayaClipboardResponse;
  error?: string;
}

export interface GayaExtractResponse {
  success: boolean;
  entities?: GayaEntity[];
  error?: string;
}

export interface GayaSearchResponse {
  success: boolean;
  records?: GayaClipboardResponse[];
  error?: string;
}

// =============================================================================
// ENTITY NAME CONSTANTS
// =============================================================================

export const GAYA_ENTITY_TYPES = {
  CUSTOMER: 'customer',
  HOUSEHOLD: 'household_member',
  DRIVER: 'driver',
  CAR: 'car',
  PROPERTY: 'property',
  AUTO_POLICY: 'auto_policy',
  HOME_POLICY: 'home_policy',
} as const;
