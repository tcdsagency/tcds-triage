/**
 * Quote Wizard V2 Type Definitions
 * =================================
 */

import { LucideIcon } from 'lucide-react';
import type { QuoteType } from '../schemas';

export type { QuoteType };

export interface StepConfig {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  fields: string[];
}

export interface QuoteTypeConfig {
  id: QuoteType;
  label: string;
  steps: StepConfig[];
}
