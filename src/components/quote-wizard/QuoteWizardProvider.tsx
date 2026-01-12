'use client';

/**
 * Quote Wizard Provider
 * =====================
 * React Context provider for managing quote wizard state.
 * Handles form data, navigation, validation, and submission.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  QuoteType,
  QuoteFormData,
  QuoteWizardContextType,
  StepConfig,
  initialFormData,
  createEmptyVehicle,
  createEmptyDriver,
} from './config/types';
import { useEligibility } from '@/hooks/useEligibility';

// =============================================================================
// CONTEXT
// =============================================================================

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
}

export function QuoteWizardProvider({
  children,
  quoteType,
  steps,
  draftId,
}: QuoteWizardProviderProps) {
  const router = useRouter();

  // Form state
  const [formData, setFormData] = useState<QuoteFormData>(initialFormData);
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Eligibility checking
  const eligibility = useEligibility(quoteType, formData as unknown as Record<string, unknown>, {
    evaluateOnMount: true,
  });

  // Storage key for auto-save
  const storageKey = useMemo(
    () => `quote-wizard-${quoteType}-${draftId || 'new'}`,
    [quoteType, draftId]
  );

  // =============================================================================
  // LOAD/SAVE DRAFT
  // =============================================================================

  // Load draft from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const { data, step } = JSON.parse(saved);
        setFormData({ ...initialFormData, ...data });
        setCurrentStep(step || 0);
        setLastSaved(new Date());
      } catch (e) {
        console.error('Failed to load draft:', e);
      }
    }
  }, [storageKey]);

  // Auto-save to localStorage on changes
  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ data: formData, step: currentStep })
      );
      setLastSaved(new Date());
    }, 1000);

    return () => clearTimeout(timeout);
  }, [formData, currentStep, storageKey]);

  // =============================================================================
  // FIELD UPDATES
  // =============================================================================

  const updateField = useCallback((field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is updated
    setErrors((prev) => {
      if (prev[field]) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return prev;
    });
  }, []);

  const updateNestedField = useCallback((section: string, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section as keyof QuoteFormData] as object),
        [field]: value,
      },
    }));
  }, []);

  // =============================================================================
  // VEHICLE MANAGEMENT
  // =============================================================================

  const addVehicle = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      vehicles: [...prev.vehicles, createEmptyVehicle()],
    }));
  }, []);

  const removeVehicle = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      vehicles: prev.vehicles.filter((v) => v.id !== id),
    }));
  }, []);

  const updateVehicle = useCallback((id: string, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      vehicles: prev.vehicles.map((v) =>
        v.id === id ? { ...v, [field]: value } : v
      ),
    }));
  }, []);

  // =============================================================================
  // DRIVER MANAGEMENT
  // =============================================================================

  const addDriver = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      drivers: [...prev.drivers, createEmptyDriver()],
    }));
  }, []);

  const removeDriver = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      drivers: prev.drivers.filter((d) => d.id !== id),
    }));
  }, []);

  const updateDriver = useCallback((id: string, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      drivers: prev.drivers.map((d) =>
        d.id === id ? { ...d, [field]: value } : d
      ),
    }));
  }, []);

  // =============================================================================
  // VALIDATION
  // =============================================================================

  const validateCurrentStep = useCallback((): boolean => {
    const step = steps[currentStep];
    if (!step) return true;

    const stepErrors = step.validate(formData);
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  }, [currentStep, formData, steps]);

  const isStepComplete = useCallback(
    (stepIndex: number): boolean => {
      const step = steps[stepIndex];
      if (!step) return false;

      const stepErrors = step.validate(formData);
      return Object.keys(stepErrors).length === 0;
    },
    [formData, steps]
  );

  const getStepProgress = useCallback((): number => {
    let completed = 0;
    for (let i = 0; i < steps.length; i++) {
      if (isStepComplete(i)) completed++;
    }
    return Math.round((completed / steps.length) * 100);
  }, [isStepComplete, steps.length]);

  // =============================================================================
  // NAVIGATION
  // =============================================================================

  const canGoNext = currentStep < steps.length - 1;
  const canGoPrev = currentStep > 0;

  const goToStep = useCallback(
    (step: number) => {
      if (step >= 0 && step < steps.length) {
        // Only allow jumping to completed steps or the next step
        if (step <= currentStep || isStepComplete(step - 1)) {
          setCurrentStep(step);
          setErrors({});
        }
      }
    },
    [currentStep, isStepComplete, steps.length]
  );

  const nextStep = useCallback(() => {
    if (validateCurrentStep() && canGoNext) {
      setCurrentStep((prev) => prev + 1);
      setErrors({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [canGoNext, validateCurrentStep]);

  const prevStep = useCallback(() => {
    if (canGoPrev) {
      setCurrentStep((prev) => prev - 1);
      setErrors({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [canGoPrev]);

  // =============================================================================
  // SAVE & SUBMIT
  // =============================================================================

  const saveAsDraft = useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: quoteType,
          status: 'draft',
          quoteData: formData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save draft');
      }

      const data = await response.json();
      setLastSaved(new Date());
      return data;
    } catch (error) {
      console.error('Failed to save draft:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [formData, quoteType]);

  const submitQuote = useCallback(async () => {
    // Validate all steps
    let allValid = true;
    for (let i = 0; i < steps.length; i++) {
      if (!isStepComplete(i)) {
        allValid = false;
        setCurrentStep(i);
        validateCurrentStep();
        break;
      }
    }

    if (!allValid) return;

    // Check for eligibility blockers
    if (eligibility.result?.status === 'DECLINE') {
      setErrors({ _global: 'Cannot submit - eligibility blockers exist' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: quoteType,
          status: 'submitted',
          contactInfo: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            address: {
              street: formData.address,
              city: formData.city,
              state: formData.state,
              zip: formData.zip,
            },
          },
          quoteData: formData,
          vehicles: quoteType === 'personal_auto' ? formData.vehicles : undefined,
          drivers: quoteType === 'personal_auto' ? formData.drivers : undefined,
          property:
            quoteType === 'homeowners'
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

      if (!response.ok) {
        throw new Error('Failed to submit quote');
      }

      // Clear localStorage
      localStorage.removeItem(storageKey);

      // Redirect to quotes list
      router.push('/quotes?submitted=true');
    } catch (error) {
      console.error('Failed to submit quote:', error);
      setErrors({ _global: 'Failed to submit quote. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    eligibility.result?.status,
    formData,
    isStepComplete,
    quoteType,
    router,
    steps.length,
    storageKey,
    validateCurrentStep,
  ]);

  // =============================================================================
  // RESET FORM
  // =============================================================================

  const resetForm = useCallback(() => {
    // Clear form data to initial state
    setFormData(initialFormData);
    setCurrentStep(0);
    setErrors({});
    setLastSaved(null);
    // Clear localStorage
    localStorage.removeItem(storageKey);
  }, [storageKey]);

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
    formData,
    updateField,
    updateNestedField,
    addVehicle,
    removeVehicle,
    updateVehicle,
    addDriver,
    removeDriver,
    updateDriver,
    errors,
    validateCurrentStep,
    isStepComplete,
    getStepProgress,
    eligibility: eligibility.result,
    saveAsDraft,
    submitQuote,
    resetForm,
    isSaving,
    isSubmitting,
    lastSaved,
  };

  return (
    <QuoteWizardContext.Provider value={value}>
      {children}
    </QuoteWizardContext.Provider>
  );
}

export default QuoteWizardProvider;
