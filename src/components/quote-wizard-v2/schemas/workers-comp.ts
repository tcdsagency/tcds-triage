import { z } from 'zod';
import {
  contactSchemaMinimal,
  propertyAddressSchema,
  currentInsuranceSchema,
  submissionSchema,
} from './shared';

const wcBusinessSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  businessType: z.string().min(1, 'Business type is required'),
  businessDescription: z.string().optional().default(''),
  yearsInBusiness: z.string().min(1, 'Years in business is required'),
  annualRevenue: z.string().min(1, 'Annual payroll is required'),
  employeeCount: z.string().min(1, 'Employee count is required'),
  fein: z.string().min(1, 'FEIN is required'),
  governingClassCode: z.string().optional().default(''),
  experienceMod: z.string().optional().default(''),
  claimsInPast3Years: z.string().optional().default('0'),
});

const wcCoverageSchema = z.object({
  // WC coverage is statutory, minimal options
  liability: z.string().optional().default(''),
});

export const workersCompSchema = contactSchemaMinimal
  .merge(wcBusinessSchema)
  .merge(propertyAddressSchema)
  .merge(currentInsuranceSchema)
  .merge(submissionSchema)
  .extend({
    coverage: wcCoverageSchema,
  });

export type WorkersCompFormData = z.infer<typeof workersCompSchema>;
