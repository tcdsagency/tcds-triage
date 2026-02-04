'use client';

import React from 'react';
import { FormCheckbox, FormFieldGrid } from '../../fields';

export function DiscountFields() {
  return (
    <FormFieldGrid cols={4}>
      <FormCheckbox name="discounts.multiPolicy" label="Multi-Policy" />
      <FormCheckbox name="discounts.homeowner" label="Homeowner" />
      <FormCheckbox name="discounts.goodDriver" label="Good Driver" />
      <FormCheckbox name="discounts.goodStudent" label="Good Student" />
      <FormCheckbox name="discounts.defensive" label="Defensive Driving" />
      <FormCheckbox name="discounts.lowMileage" label="Low Mileage" />
      <FormCheckbox name="discounts.paperless" label="Paperless" />
      <FormCheckbox name="discounts.autoPay" label="Auto-Pay" />
      <FormCheckbox name="discounts.claimFree" label="Claim Free" />
      <FormCheckbox name="discounts.newPurchase" label="New Purchase" />
      <FormCheckbox name="discounts.loyalty" label="Loyalty" />
    </FormFieldGrid>
  );
}

export default DiscountFields;
