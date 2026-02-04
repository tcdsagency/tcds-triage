import { z } from 'zod';
import {
  contactSchema,
  propertyAddressSchema,
  currentInsuranceSchema,
  claimsSchema,
  discountSchema,
  submissionSchema,
} from './shared';

const rentersCoverageSchema = z.object({
  personalProperty: z.string().min(1, 'Personal property coverage is required'),
  liability: z.string().min(1, 'Liability coverage is required'),
  medicalPayments: z.string().optional().default('5000'),
  deductible: z.string().optional().default('1000'),
  waterBackup: z.boolean().optional().default(false),
  identityTheft: z.boolean().optional().default(false),
});

export const rentersSchema = contactSchema
  .merge(propertyAddressSchema)
  .merge(currentInsuranceSchema)
  .merge(claimsSchema)
  .merge(submissionSchema)
  .extend({
    unitType: z.string().optional().default(''),
    moveInDate: z.string().optional().default(''),
    coverage: rentersCoverageSchema,
    discounts: discountSchema,
  });

export type RentersFormData = z.infer<typeof rentersSchema>;
