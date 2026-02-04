import { z } from 'zod';
import {
  contactSchema,
  addressSchema,
  spouseSchema,
  licenseSchema,
  vehicleSchema,
  driverSchema,
  autoCoverageSchema,
  currentInsuranceSchema,
  claimsSchema,
  discountSchema,
  submissionSchema,
} from './shared';

export const personalAutoSchema = contactSchema
  .merge(addressSchema)
  .merge(spouseSchema)
  .merge(licenseSchema)
  .merge(currentInsuranceSchema)
  .merge(claimsSchema)
  .merge(submissionSchema)
  .extend({
    vehicles: z.array(vehicleSchema).min(1, 'At least one vehicle is required'),
    drivers: z.array(driverSchema).min(1, 'At least one driver is required'),
    coverage: autoCoverageSchema,
    discounts: discountSchema,
  });

export type PersonalAutoFormData = z.infer<typeof personalAutoSchema>;
