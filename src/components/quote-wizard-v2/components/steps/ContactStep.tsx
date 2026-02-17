'use client';

/**
 * ContactStep
 * ===========
 * Renders ContactFields and performs automatic customer lookup
 * when both first and last name are entered (2+ chars each).
 * If matches are found, a selection modal lets the agent prefill
 * the form from an existing customer record.
 */

import React, { useState, useCallback, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuoteWizard } from '../../QuoteWizardProvider';
import { ContactFields } from '../shared';
import CustomerSearchModal from '@/components/features/CustomerSearchModal';

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
  const { watch, setValue } = useFormContext();
  const { quoteType, setCustomerId } = useQuoteWizard();

  const [modalOpen, setModalOpen] = useState(false);
  const [linkedCustomer, setLinkedCustomer] = useState<{ id: string; name: string } | null>(null);

  // Track which name combo we already searched so we don't re-trigger
  const searchedNameRef = useRef<string>('');

  const handleLastNameBlur = useCallback(() => {
    const firstName = (watch('firstName') || '').trim();
    const lastName = (watch('lastName') || '').trim();

    if (firstName.length < 2 || lastName.length < 2) return;

    const nameKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}`;
    if (searchedNameRef.current === nameKey) return;

    searchedNameRef.current = nameKey;
    setModalOpen(true);
  }, [watch]);

  const handleCustomerSelect = useCallback((customer: any) => {
    // Basic contact fields
    if (customer.firstName) setValue('firstName', customer.firstName);
    if (customer.lastName) setValue('lastName', customer.lastName);
    if (customer.phone) setValue('phone', customer.phone);
    if (customer.email) setValue('email', customer.email);

    // Address (jsonb: { street, city, state, zip })
    if (customer.address) {
      if (customer.address.street) setValue('address', customer.address.street);
      if (customer.address.city) setValue('city', customer.address.city);
      if (customer.address.state) setValue('state', customer.address.state);
      if (customer.address.zip) setValue('zip', customer.address.zip);
    }

    // DOB from customer record or first policy driver
    if (customer.dateOfBirth) {
      setValue('dob', customer.dateOfBirth);
    } else if (customer.policies?.length) {
      const primaryDriver = customer.policies
        .flatMap((p: any) => p.drivers || [])
        .find((d: any) => d.dateOfBirth);
      if (primaryDriver?.dateOfBirth) {
        setValue('dob', primaryDriver.dateOfBirth);
      }
    }

    // Pull gender/maritalStatus from demographics if available on customer
    // (These aren't on the search result directly, but policy data may help)

    // For auto quotes, prefill vehicles and drivers from active policies
    if (quoteType === 'personal_auto' || quoteType === 'recreational') {
      const activePolicies = (customer.policies || []).filter((p: any) => p.isActive);
      const autoPolicy = activePolicies.find((p: any) =>
        p.lineOfBusiness?.toLowerCase().includes('auto') ||
        p.type === 'auto'
      );

      if (autoPolicy) {
        // Prefill vehicles
        if (autoPolicy.vehicles?.length) {
          const vehicles = autoPolicy.vehicles.map((v: any) => ({
            id: crypto.randomUUID(),
            year: v.year || '',
            make: v.make || '',
            model: v.model || '',
            vin: v.vin || '',
            use: v.use || '',
            annualMiles: v.annualMiles || '',
          }));
          setValue('vehicles', vehicles);
        }

        // Prefill drivers
        if (autoPolicy.drivers?.length) {
          const drivers = autoPolicy.drivers.map((d: any) => ({
            id: crypto.randomUUID(),
            firstName: d.firstName || '',
            lastName: d.lastName || '',
            dob: d.dateOfBirth || '',
            gender: '',
            relationship: d.relationship || '',
            licenseNumber: d.licenseNumber || '',
            licenseState: d.licenseState || '',
            yearsLicensed: '',
            hasAccidents: false,
            hasViolations: false,
          }));
          setValue('drivers', drivers);
        }
      }
    }

    // For home quotes, prefill property fields from active policies
    if (quoteType === 'homeowners' || quoteType === 'mobile_home') {
      const activePolicies = (customer.policies || []).filter((p: any) => p.isActive);
      const homePolicy = activePolicies.find((p: any) =>
        p.lineOfBusiness?.toLowerCase().includes('home') ||
        p.lineOfBusiness?.toLowerCase().includes('dwelling') ||
        p.type === 'home'
      );

      if (homePolicy?.properties?.[0]) {
        const prop = homePolicy.properties[0];
        if (prop.address) setValue('propertyAddress', prop.address);
        if (prop.yearBuilt) setValue('yearBuilt', prop.yearBuilt);
        if (prop.squareFeet) setValue('squareFootage', prop.squareFeet);
        if (prop.constructionType) setValue('constructionType', prop.constructionType);
        if (prop.roofType) setValue('roofMaterial', prop.roofType);
        if (prop.roofAge) setValue('roofAge', prop.roofAge);
      }
    }

    // Link the customer
    setLinkedCustomer({
      id: customer.id,
      name: `${customer.firstName} ${customer.lastName}`.trim(),
    });
    setCustomerId(customer.id);
    setModalOpen(false);
  }, [setValue, quoteType, setCustomerId]);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
  }, []);

  const handleUnlink = useCallback(() => {
    setLinkedCustomer(null);
    setCustomerId(null);
    // Allow re-search on next blur
    searchedNameRef.current = '';
  }, [setCustomerId]);

  const firstName = watch('firstName') || '';
  const lastName = watch('lastName') || '';
  const initialQuery = `${firstName} ${lastName}`.trim();

  return (
    <>
      {linkedCustomer && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
          </svg>
          <span className="text-sm text-blue-800 dark:text-blue-200">
            Linked to: <strong>{linkedCustomer.name}</strong>
          </span>
          <button
            type="button"
            onClick={handleUnlink}
            className="ml-auto p-1 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
            title="Unlink customer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <ContactFields
        showLicense={showLicense}
        showSpouse={showSpouse}
        showAddress={showAddress}
        onLastNameBlur={handleLastNameBlur}
      />

      <CustomerSearchModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSelect={handleCustomerSelect}
        initialQuery={initialQuery}
        title="Existing Customer Found"
      />
    </>
  );
}

export default ContactStep;
