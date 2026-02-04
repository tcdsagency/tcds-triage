import { z } from 'zod';
import {
  contactSchemaMinimal,
  propertyAddressSchema,
  currentInsuranceSchema,
  submissionSchema,
} from './shared';

const glBusinessSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  businessType: z.string().min(1, 'Business type is required'),
  businessDescription: z.string().min(1, 'Business description is required'),
  yearsInBusiness: z.string().min(1, 'Years in business is required'),
  annualRevenue: z.string().min(1, 'Annual revenue is required'),
  employeeCount: z.string().optional().default(''),
  fein: z.string().optional().default(''),
  classCode: z.string().optional().default(''),
  hasSubcontractors: z.boolean().optional().default(false),
  needsCOI: z.boolean().optional().default(false),
});

const glCoverageSchema = z.object({
  liability: z.string().min(1, 'Liability limit is required'),
  aggregate: z.string().optional().default(''),
  medicalPayments: z.string().optional().default(''),
  deductible: z.string().optional().default(''),
});

export const generalLiabilitySchema = contactSchemaMinimal
  .merge(glBusinessSchema)
  .merge(propertyAddressSchema)
  .merge(currentInsuranceSchema)
  .merge(submissionSchema)
  .extend({
    coverage: glCoverageSchema,
  });

export type GeneralLiabilityFormData = z.infer<typeof generalLiabilitySchema>;
