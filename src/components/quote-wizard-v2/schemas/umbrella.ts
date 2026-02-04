import { z } from 'zod';
import {
  contactSchema,
  addressSchema,
  liabilityExposuresSchema,
  currentInsuranceSchema,
  submissionSchema,
} from './shared';

const umbrellaCoverageSchema = z.object({
  umbrellaLimit: z.string().min(1, 'Umbrella limit is required'),
  bodilyInjury: z.string().optional().default(''),
  liability: z.string().optional().default(''),
});

export const umbrellaSchema = contactSchema
  .merge(addressSchema)
  .merge(liabilityExposuresSchema)
  .merge(currentInsuranceSchema)
  .merge(submissionSchema)
  .extend({
    coverage: umbrellaCoverageSchema,
    currentCarrier: z.string().optional().default(''),
  });

export type UmbrellaFormData = z.infer<typeof umbrellaSchema>;
