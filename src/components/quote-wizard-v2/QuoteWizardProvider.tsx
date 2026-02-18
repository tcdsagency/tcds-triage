'use client';

/**
 * QuoteWizardProvider
 * ====================
 * Manages wizard navigation, auto-save, and submission.
 * Form data lives in RHF (via QuoteFormProvider), NOT here.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFormContext } from 'react-hook-form';
import type { QuoteType } from './schemas';
import type { StepConfig } from './config/types';
import { useEligibility } from '@/hooks/useEligibility';

// =============================================================================
// CONTEXT
// =============================================================================

interface QuoteWizardContextType {
  quoteType: QuoteType;
  currentStep: number;
  totalSteps: number;
  steps: StepConfig[];
  goToStep: (step: number) => void;
  nextStep: () => Promise<boolean>;
  prevStep: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
  eligibility: any;
  saveAsDraft: () => Promise<void>;
  submitQuote: () => Promise<void>;
  resetForm: () => void;
  isSaving: boolean;
  isSubmitting: boolean;
  lastSaved: Date | null;
  customerId: string | null;
  setCustomerId: (id: string | null) => void;
  ezlynxApplicantId: string | null;
  setEzlynxApplicantId: (id: string | null) => void;
}

const QuoteWizardContext = createContext<QuoteWizardContextType | null>(null);

export function useQuoteWizard() {
  const context = useContext(QuoteWizardContext);
  if (!context) {
    throw new Error('useQuoteWizard must be used within QuoteWizardProvider');
  }
  return context;
}

// =============================================================================
// PROVIDER
// =============================================================================

interface QuoteWizardProviderProps {
  children: React.ReactNode;
  quoteType: QuoteType;
  steps: StepConfig[];
  draftId?: string;
  callId?: string;
}

export function QuoteWizardProvider({
  children,
  quoteType,
  steps,
  draftId,
  callId,
}: QuoteWizardProviderProps) {
  const router = useRouter();
  const { trigger, handleSubmit, watch, reset, getValues, setValue } = useFormContext();

  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [ezlynxApplicantId, setEzlynxApplicantId] = useState<string | null>(null);

  const watchedValues = watch();

  // Eligibility
  const eligibility = useEligibility(quoteType, watchedValues as unknown as Record<string, unknown>, {
    evaluateOnMount: true,
  });

  // Storage key for auto-save
  const storageKey = useMemo(
    () => `quote-wizard-v2-${quoteType}-${draftId || 'new'}`,
    [quoteType, draftId]
  );

  // =============================================================================
  // LOAD DRAFT
  // =============================================================================

  const hasLoadedDraft = useRef(false);
  useEffect(() => {
    if (hasLoadedDraft.current) return;
    hasLoadedDraft.current = true;

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const { data, step } = JSON.parse(saved);
        if (data) {
          Object.entries(data).forEach(([key, value]) => {
            setValue(key, value);
          });
          setCurrentStep(step || 0);
          setLastSaved(new Date());
        }
      } catch (e) {
        console.error('Failed to load draft:', e);
      }
    }
  }, [storageKey, setValue]);

  // =============================================================================
  // AUTO-SAVE
  // =============================================================================

  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ data: getValues(), step: currentStep })
        );
        setLastSaved(new Date());
      } catch {
        // localStorage might be full
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [watchedValues, currentStep, storageKey, getValues]);

  // =============================================================================
  // AUTO-POPULATE DRIVERS
  // =============================================================================

  useEffect(() => {
    if (quoteType !== 'personal_auto' && quoteType !== 'recreational') return;
    const driversStepIndex = steps.findIndex(s => s.id === 'drivers');
    if (driversStepIndex === -1 || currentStep !== driversStepIndex) return;

    const values = getValues();
    const drivers = values.drivers;
    if (!drivers || drivers.length !== 1 || drivers[0].firstName?.trim()) return;
    if (!values.firstName?.trim() || !values.lastName?.trim()) return;

    const newDrivers: any[] = [{
      id: crypto.randomUUID(),
      firstName: values.firstName,
      lastName: values.lastName,
      dob: values.dob || '',
      gender: values.gender || '',
      relationship: 'self',
      licenseNumber: values.licenseNumber || '',
      licenseState: values.licenseState || '',
      yearsLicensed: '',
      hasAccidents: false,
      hasViolations: false,
    }];

    if (values.maritalStatus === 'married' && values.spouseFirstName?.trim()) {
      newDrivers.push({
        id: crypto.randomUUID(),
        firstName: values.spouseFirstName,
        lastName: values.spouseLastName || values.lastName,
        dob: values.spouseDob || '',
        gender: '',
        relationship: 'spouse',
        licenseNumber: values.spouseLicenseNumber || '',
        licenseState: values.spouseLicenseState || '',
        yearsLicensed: '',
        hasAccidents: false,
        hasViolations: false,
      });
    }

    setValue('drivers', newDrivers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, quoteType, steps]);

  // =============================================================================
  // NAVIGATION
  // =============================================================================

  const canGoNext = currentStep < steps.length - 1;
  const canGoPrev = currentStep > 0;

  const nextStep = useCallback(async (): Promise<boolean> => {
    const step = steps[currentStep];
    if (!step) return false;

    const valid = await trigger(step.fields);
    if (!valid) return false;

    if (canGoNext) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    return true;
  }, [canGoNext, currentStep, steps, trigger]);

  const prevStep = useCallback(() => {
    if (canGoPrev) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [canGoPrev]);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < steps.length && step <= currentStep) {
      setCurrentStep(step);
    }
  }, [currentStep, steps.length]);

  // =============================================================================
  // SAVE DRAFT
  // =============================================================================

  const saveAsDraft = useCallback(async () => {
    setIsSaving(true);
    try {
      const formData = getValues();
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: quoteType,
          status: 'draft',
          customerId,
          quoteData: formData,
        }),
      });
      if (!response.ok) throw new Error('Failed to save draft');
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save draft:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [getValues, quoteType, customerId]);

  // =============================================================================
  // SUBMIT
  // =============================================================================

  const submitQuote = useCallback(async () => {
    if (eligibility.result?.status === 'DECLINE') return;

    setIsSubmitting(true);
    try {
      await handleSubmit(async (formData: any) => {
        const response = await fetch('/api/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: quoteType,
            status: 'submitted',
            callId,
            customerId,
            contactInfo: {
              firstName: formData.firstName,
              lastName: formData.lastName,
              email: formData.email,
              phone: formData.phone,
              address: {
                street: formData.address || formData.propertyAddress,
                city: formData.city || formData.propertyCity,
                state: formData.state || formData.propertyState,
                zip: formData.zip || formData.propertyZip,
              },
            },
            quoteData: formData,
            vehicles: formData.vehicles,
            drivers: formData.drivers,
            property: formData.propertyAddress
              ? {
                  address: formData.propertyAddress,
                  yearBuilt: formData.yearBuilt,
                  squareFeet: formData.squareFootage,
                  constructionType: formData.constructionType,
                  roofType: formData.roofMaterial,
                  roofAge: formData.roofAge,
                }
              : undefined,
            notes: formData.agentNotes,
          }),
        });

        if (!response.ok) throw new Error('Failed to submit quote');

        localStorage.removeItem(storageKey);
        router.push('/quotes?submitted=true');
      }, (errors) => {
        // Find the first step with errors and jump to it
        for (let i = 0; i < steps.length; i++) {
          const stepFields = steps[i].fields;
          const hasError = stepFields.some(field => {
            const parts = field.split('.');
            let err: any = errors;
            for (const part of parts) {
              err = err?.[part];
              if (!err) break;
            }
            return !!err;
          });
          if (hasError) {
            setCurrentStep(i);
            break;
          }
        }
      })();
    } catch (error) {
      console.error('Failed to submit quote:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [eligibility.result?.status, getValues, handleSubmit, quoteType, router, steps, storageKey, callId, customerId]);

  // =============================================================================
  // RESET
  // =============================================================================

  const resetForm = useCallback(() => {
    reset();
    setCurrentStep(0);
    setLastSaved(null);
    localStorage.removeItem(storageKey);
  }, [reset, storageKey]);

  // =============================================================================
  // CONTEXT VALUE
  // =============================================================================

  const value: QuoteWizardContextType = {
    quoteType,
    currentStep,
    totalSteps: steps.length,
    steps,
    goToStep,
    nextStep,
    prevStep,
    canGoNext,
    canGoPrev,
    eligibility: eligibility.result,
    saveAsDraft,
    submitQuote,
    resetForm,
    isSaving,
    isSubmitting,
    lastSaved,
    customerId,
    setCustomerId,
    ezlynxApplicantId,
    setEzlynxApplicantId,
  };

  return (
    <QuoteWizardContext.Provider value={value}>
      {children}
    </QuoteWizardContext.Provider>
  );
}

export default QuoteWizardProvider;
