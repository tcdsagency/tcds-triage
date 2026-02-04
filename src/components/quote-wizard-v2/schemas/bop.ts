import { z } from 'zod';
import {
  contactSchemaMinimal,
  businessSchema,
  propertyAddressSchema,
  currentInsuranceSchema,
  submissionSchema,
} from './shared';

const bopCoverageSchema = z.object({
  liability: z.string().min(1, 'Liability coverage is required'),
  propertyDamage: z.string().optional().default(''),
  medicalPayments: z.string().optional().default(''),
  deductible: z.string().optional().default('1000'),
});

export const bopSchema = contactSchemaMinimal
  .merge(businessSchema)
  .merge(propertyAddressSchema)
  .merge(currentInsuranceSchema)
  .merge(submissionSchema)
  .extend({
    coverage: bopCoverageSchema,
  });

export type BopFormData = z.infer<typeof bopSchema>;
