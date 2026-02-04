import { z } from 'zod';
import {
  contactSchema,
  propertyAddressSchema,
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

export const mobileHomeSchema = contactSchema
  .merge(propertyAddressSchema)
  .merge(systemsSchema)
  .merge(safetySchema)
  .merge(liabilityExposuresSchema)
  .merge(mortgageSchema)
  .merge(currentInsuranceSchema)
  .merge(claimsSchema)
  .merge(submissionSchema)
  .extend({
    propertyType: z.string().optional().default('mobile_home'),
    occupancy: z.string().optional().default(''),
    yearBuilt: z.string().min(1, 'Year built is required'),
    squareFootage: z.string().optional().default(''),
    stories: z.string().optional().default('1'),
    constructionType: z.string().min(1, 'Construction type is required'),
    foundationType: z.string().optional().default(''),
    garageType: z.string().optional().default(''),
    roofMaterial: z.string().optional().default(''),
    roofAge: z.string().optional().default(''),
    rprData: z.any().optional().default(null),
    coverage: homeCoverageSchema,
    discounts: discountSchema,
  });

export type MobileHomeFormData = z.infer<typeof mobileHomeSchema>;
