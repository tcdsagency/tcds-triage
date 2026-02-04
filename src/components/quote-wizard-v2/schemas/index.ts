/**
 * Schema Index
 * =============
 * Exports all schemas and the getSchemaForType() resolver.
 */

import { z } from 'zod';
import { personalAutoSchema } from './personal-auto';
import { homeownersSchema } from './homeowners';
import { mobileHomeSchema } from './mobile-home';
import { rentersSchema } from './renters';
import { umbrellaSchema } from './umbrella';
import { bopSchema } from './bop';
import { generalLiabilitySchema } from './general-liability';
import { workersCompSchema } from './workers-comp';
import { recreationalSchema } from './recreational';
import { floodSchema } from './flood';

export type QuoteType =
  | 'personal_auto'
  | 'homeowners'
  | 'renters'
  | 'mobile_home'
  | 'flood'
  | 'umbrella'
  | 'bop'
  | 'general_liability'
  | 'workers_comp'
  | 'recreational';

const schemaMap: Record<QuoteType, z.ZodType> = {
  personal_auto: personalAutoSchema,
  homeowners: homeownersSchema,
  mobile_home: mobileHomeSchema,
  renters: rentersSchema,
  umbrella: umbrellaSchema,
  bop: bopSchema,
  general_liability: generalLiabilitySchema,
  workers_comp: workersCompSchema,
  recreational: recreationalSchema,
  flood: floodSchema,
};

export function getSchemaForType(type: QuoteType): z.ZodType {
  return schemaMap[type];
}

export {
  personalAutoSchema,
  homeownersSchema,
  mobileHomeSchema,
  rentersSchema,
  umbrellaSchema,
  bopSchema,
  generalLiabilitySchema,
  workersCompSchema,
  recreationalSchema,
  floodSchema,
};

export * from './shared';
