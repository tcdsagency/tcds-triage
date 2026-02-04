import { z } from 'zod';
import {
  contactSchema,
  propertyAddressSchema,
  currentInsuranceSchema,
  claimsSchema,
  submissionSchema,
} from './shared';

const floodDetailsSchema = z.object({
  propertyType: z.string().min(1, 'Property type is required'),
  yearBuilt: z.string().min(1, 'Year built is required'),
  squareFootage: z.string().optional().default(''),
  foundationType: z.string().min(1, 'Foundation type is required'),
  stories: z.string().optional().default(''),
  constructionType: z.string().optional().default(''),
  elevationCertificate: z.boolean().optional().default(false),
  baseFloodElevation: z.string().optional().default(''),
  lowestFloorElevation: z.string().optional().default(''),
  occupancy: z.string().optional().default(''),
  rprData: z.any().optional().default(null),
});

const floodCoverageSchema = z.object({
  dwelling: z.string().min(1, 'Building coverage is required'),
  personalProperty: z.string().optional().default(''),
  deductible: z.string().optional().default('1000'),
});

export const floodSchema = contactSchema
  .merge(propertyAddressSchema)
  .merge(floodDetailsSchema)
  .merge(currentInsuranceSchema)
  .merge(claimsSchema)
  .merge(submissionSchema)
  .extend({
    coverage: floodCoverageSchema,
  });

export type FloodFormData = z.infer<typeof floodSchema>;
