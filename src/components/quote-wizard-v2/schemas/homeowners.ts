import { z } from 'zod';
import {
  contactSchema,
  propertyAddressSchema,
  propertyDetailsSchema,
  systemsSchema,
  safetySchema,
  liabilityExposuresSchema,
  mortgageSchema,
  homeCoverageSchema,
  currentInsuranceSchema,
  claimsSchema,
  discountSchema,
  submissionSchema,
} from './shared';

export const homeownersSchema = contactSchema
  .merge(propertyAddressSchema)
  .merge(propertyDetailsSchema)
  .merge(systemsSchema)
  .merge(safetySchema)
  .merge(liabilityExposuresSchema)
  .merge(mortgageSchema)
  .merge(currentInsuranceSchema)
  .merge(claimsSchema)
  .merge(submissionSchema)
  .extend({
    coverage: homeCoverageSchema,
    discounts: discountSchema,
  });

export type HomeownersFormData = z.infer<typeof homeownersSchema>;
