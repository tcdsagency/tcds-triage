'use client';

import React from 'react';
import { Users, DollarSign, FileWarning } from 'lucide-react';
import {
  FormInput,
  FormCurrencyInput,
  FormSection,
  FormFieldGrid,
} from '../../fields';

export function EmployeesStep() {
  return (
    <div className="space-y-8">
      {/* Employee Counts */}
      <FormSection title="Employee Information" icon={Users}>
        <FormFieldGrid cols={2}>
          <FormInput
            name="employeeCount"
            label="Number of Employees"
            type="number"
          />
          <FormCurrencyInput
            name="annualRevenue"
            label="Annual Revenue"
          />
        </FormFieldGrid>
      </FormSection>

      {/* Payroll / Classification */}
      <FormSection title="Payroll Information" icon={DollarSign}>
        <FormFieldGrid cols={2}>
          <FormInput
            name="governingClassCode"
            label="Governing Class Code"
            placeholder="e.g. 8810"
          />
          <FormInput
            name="experienceMod"
            label="Experience Modification Factor"
            type="number"
            placeholder="1.00"
          />
        </FormFieldGrid>
      </FormSection>

      {/* Claims History */}
      <FormSection title="Claims History" icon={FileWarning}>
        <FormInput
          name="claimsInPast3Years"
          label="Claims in Past 3 Years"
          type="number"
          placeholder="0"
        />
      </FormSection>
    </div>
  );
}

export default EmployeesStep;
