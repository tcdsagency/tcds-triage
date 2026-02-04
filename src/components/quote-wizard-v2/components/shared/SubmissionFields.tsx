'use client';

import React from 'react';
import { Info, Calendar } from 'lucide-react';
import { FormDateInput, FormTextarea, FormSection } from '../../fields';

export function SubmissionFields() {
  return (
    <FormSection title="Submission Details" icon={Calendar}>
      <FormDateInput name="effectiveDate" label="Effective Date" required />
      <FormTextarea
        name="agentNotes"
        label="Agent Notes"
        placeholder="Add any additional notes..."
        rows={4}
      />
      <div className="flex gap-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300">
          By submitting this quote request, you confirm that the information
          provided is accurate to the best of your knowledge. Our team will
          review the details and prepare quotes from available carriers.
          Submission does not bind coverage. A licensed agent will follow up to
          finalize any policy selections.
        </p>
      </div>
    </FormSection>
  );
}

export default SubmissionFields;
