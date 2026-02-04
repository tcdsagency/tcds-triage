'use client';

/**
 * ContactStep
 * ===========
 * Simple step that renders ContactFields with configurable props.
 */

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuoteWizard } from '../../QuoteWizardProvider';
import { ContactFields } from '../shared';

interface ContactStepProps {
  showLicense?: boolean;
  showSpouse?: boolean;
  showAddress?: boolean;
}

export function ContactStep({
  showLicense,
  showSpouse,
  showAddress,
}: ContactStepProps) {
  // Access form and wizard context (available for future use / validation)
  useFormContext();
  useQuoteWizard();

  return (
    <ContactFields
      showLicense={showLicense}
      showSpouse={showSpouse}
      showAddress={showAddress}
    />
  );
}

export default ContactStep;
