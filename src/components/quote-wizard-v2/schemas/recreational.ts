import { z } from 'zod';
import {
  contactSchema,
  addressSchema,
  vehicleSchema,
  autoCoverageSchema,
  currentInsuranceSchema,
  claimsSchema,
  discountSchema,
  submissionSchema,
} from './shared';

export const recreationalSchema = contactSchema
  .merge(addressSchema)
  .merge(currentInsuranceSchema)
  .merge(claimsSchema)
  .merge(submissionSchema)
  .extend({
    vehicles: z.array(vehicleSchema).min(1, 'At least one recreational vehicle is required'),
    coverage: autoCoverageSchema,
    discounts: discountSchema,
  });

export type RecreationalFormData = z.infer<typeof recreationalSchema>;
