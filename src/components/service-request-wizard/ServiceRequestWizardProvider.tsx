'use client';

/**
 * Service Request Wizard Provider
 * ================================
 * React Context for managing service request wizard state.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ServiceRequestWizardContextType,
  ServiceRequestFormData,
  PolicySearchResult,
  ChangeType,
  initialFormData,
} from './config/types';

const ServiceRequestWizardContext = createContext<ServiceRequestWizardContextType | null>(null);

export function useServiceRequestWizard() {
  const context = useContext(ServiceRequestWizardContext);
  if (!context) {
    throw new Error('useServiceRequestWizard must be used within ServiceRequestWizardProvider');
  }
  return context;
}

interface ProviderProps {
  children: React.ReactNode;
  prefillPolicyNumber?: string;
  prefillName?: string;
}

// Steps: 0 = Policy Search, 1 = Select Type, 2 = Form, 3 = Review
const TOTAL_STEPS = 4;

// Additional context for prefill
const PrefillContext = React.createContext<{ prefillQuery?: string }>({});

export function usePrefill() {
  return React.useContext(PrefillContext);
}

export function ServiceRequestWizardProvider({ children, prefillPolicyNumber, prefillName }: ProviderProps) {
  const prefillQuery = prefillPolicyNumber || prefillName;
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<ServiceRequestFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingPolicyDetails, setLoadingPolicyDetails] = useState(false);
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [assigneeName, setAssigneeName] = useState<string | null>(null);

  // Auto-save to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('serviceRequest_draft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem('serviceRequest_draft', JSON.stringify(formData));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [formData]);

  // Update field
  const updateField = useCallback(<K extends keyof ServiceRequestFormData>(
    field: K,
    value: ServiceRequestFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    setErrors(prev => {
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
  }, []);

  // Update nested field
  const updateNestedField = useCallback(<
    K extends keyof ServiceRequestFormData,
    F extends keyof NonNullable<ServiceRequestFormData[K]>
  >(
    section: K,
    field: F,
    value: any
  ) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as any),
        [field]: value,
      },
    }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[`${section as string}.${field as string}`];
      return next;
    });
  }, []);

  // Select policy and fetch details (vehicles, drivers)
  const selectPolicy = useCallback(async (policy: PolicySearchResult) => {
    setFormData(prev => ({ ...prev, policy, policyDetails: null }));
    setCurrentStep(1);

    // Fetch policy details in background
    setLoadingPolicyDetails(true);
    try {
      const res = await fetch(`/api/policy/${policy.id}/details`);
      const data = await res.json();

      if (data.success) {
        setFormData(prev => ({
          ...prev,
          policyDetails: {
            vehicles: data.vehicles || [],
            drivers: data.drivers || [],
          },
        }));
      }
    } catch (e) {
      console.error('Failed to fetch policy details:', e);
    } finally {
      setLoadingPolicyDetails(false);
    }
  }, []);

  // Select change type
  const selectChangeType = useCallback((type: ChangeType) => {
    setFormData(prev => ({ ...prev, changeType: type }));
    setCurrentStep(2);
  }, []);

  // Navigation
  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < TOTAL_STEPS) {
      setCurrentStep(step);
    }
  }, []);

  const nextStep = useCallback(() => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS - 1));
    }
  }, [formData, currentStep]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  // Validation
  const validateCurrentStep = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    switch (currentStep) {
      case 0: // Policy Search
        if (!formData.policy) {
          newErrors.policy = 'Please select a policy';
        }
        break;

      case 1: // Change Type
        if (!formData.changeType) {
          newErrors.changeType = 'Please select a change type';
        }
        break;

      case 2: // Form (varies by change type)
        if (!formData.effectiveDate) {
          newErrors.effectiveDate = 'Effective date is required';
        }
        // Additional validation based on change type
        if (formData.changeType === 'add_vehicle') {
          if (!formData.vehicle.year) newErrors['vehicle.year'] = 'Year is required';
          if (!formData.vehicle.make) newErrors['vehicle.make'] = 'Make is required';
          if (!formData.vehicle.model) newErrors['vehicle.model'] = 'Model is required';
        }
        if (formData.changeType === 'add_driver') {
          if (!formData.driver.firstName) newErrors['driver.firstName'] = 'First name is required';
          if (!formData.driver.lastName) newErrors['driver.lastName'] = 'Last name is required';
          if (!formData.driver.dob) newErrors['driver.dob'] = 'Date of birth is required';
          if (!formData.driver.licenseNumber) newErrors['driver.licenseNumber'] = 'License number is required';
        }
        if (formData.changeType === 'address_change') {
          if (!formData.address.newAddress) newErrors['address.newAddress'] = 'Address is required';
          if (!formData.address.newCity) newErrors['address.newCity'] = 'City is required';
          if (!formData.address.newState) newErrors['address.newState'] = 'State is required';
          if (!formData.address.newZip) newErrors['address.newZip'] = 'ZIP is required';
        }
        break;

      case 3: // Review
        // No additional validation needed
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentStep, formData]);

  // Submit
  const submitRequest = useCallback(async () => {
    if (!validateCurrentStep()) return;

    setIsSubmitting(true);
    try {
      // Build submission data based on change type
      let data: Record<string, any> = {
        effectiveDate: formData.effectiveDate,
        notes: formData.notes,
      };

      switch (formData.changeType) {
        case 'add_vehicle':
          data = {
            ...data,
            ...formData.vehicle,
            isReplacing: formData.isReplacing,
            replacingVehicleId: formData.replacingVehicleId,
            replacingVehicle: formData.isReplacing
              ? formData.policyDetails?.vehicles.find(v => v.id === formData.replacingVehicleId)?.displayName
              : undefined,
          };
          break;
        case 'replace_vehicle':
          data = { ...data, ...formData.vehicle };
          break;
        case 'remove_vehicle':
          // Get vehicle display name from selected ID
          const selectedVehicle = formData.policyDetails?.vehicles.find(
            v => v.id === formData.selectedVehicleId
          );
          data = {
            ...data,
            vehicleToRemove: selectedVehicle?.displayName || formData.vehicleToRemove,
            selectedVehicleId: formData.selectedVehicleId,
            removalReason: formData.removalReason,
            newOwnerInfo: formData.newOwnerInfo,
            isReplacing: formData.isReplacing,
            stillInPossession: formData.stillInPossession,
            outOfPossessionDate: formData.outOfPossessionDate,
          };
          break;
        case 'add_driver':
          data = { ...data, ...formData.driver };
          break;
        case 'remove_driver':
          // Get driver display name from selected ID
          const selectedDriver = formData.policyDetails?.drivers.find(
            d => d.id === formData.selectedDriverId
          );
          data = {
            ...data,
            driverToRemove: selectedDriver?.displayName || formData.driverToRemove,
            selectedDriverId: formData.selectedDriverId,
            removalReason: formData.driverRemovalReason,
          };
          break;
        case 'address_change':
          data = { ...data, ...formData.address };
          break;
        case 'add_mortgagee':
        case 'remove_mortgagee':
          data = { ...data, ...formData.mortgagee };
          break;
        case 'coverage_change':
          data = { ...data, ...formData.coverageChange };
          break;
        case 'cancel_policy':
          data = { ...data, ...formData.cancellation };
          break;
      }

      const res = await fetch('/api/policy-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyId: formData.policy?.id,
          policyNumber: formData.policy?.policyNumber,
          changeType: formData.changeType,
          data,
          assigneeId: assigneeId || undefined,
          assigneeName: assigneeName || undefined,
        }),
      });

      const result = await res.json();

      if (result.success) {
        // Clear draft
        localStorage.removeItem('serviceRequest_draft');
        // Show success and redirect
        alert(`Change request submitted!\n\nID: ${result.changeRequestId}\n${result.summary}`);
        router.push('/customers');
      } else {
        setErrors({ submit: result.error || 'Failed to submit request' });
      }
    } catch (e) {
      console.error(e);
      setErrors({ submit: 'Failed to submit request. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, router, validateCurrentStep, assigneeId, assigneeName]);

  // Handle assignee selection
  const handleAssigneeSelect = useCallback((id: number, name: string) => {
    setAssigneeId(id);
    setAssigneeName(name);
    setShowAssigneeModal(false);
  }, []);

  // Open assignee modal (called before submit)
  const openAssigneeModal = useCallback(() => {
    if (validateCurrentStep()) {
      setShowAssigneeModal(true);
    }
  }, [validateCurrentStep]);

  // Submit with specific assignee (bypasses state timing issues)
  const submitWithAssignee = useCallback(async (selectedAssigneeId: number, selectedAssigneeName: string) => {
    if (!validateCurrentStep()) return;

    setAssigneeId(selectedAssigneeId);
    setAssigneeName(selectedAssigneeName);
    setShowAssigneeModal(false);
    setIsSubmitting(true);

    try {
      // Build submission data based on change type
      let data: Record<string, any> = {
        effectiveDate: formData.effectiveDate,
        notes: formData.notes,
      };

      switch (formData.changeType) {
        case 'add_vehicle':
          data = {
            ...data,
            ...formData.vehicle,
            isReplacing: formData.isReplacing,
            replacingVehicleId: formData.replacingVehicleId,
            replacingVehicle: formData.isReplacing
              ? formData.policyDetails?.vehicles.find(v => v.id === formData.replacingVehicleId)?.displayName
              : undefined,
          };
          break;
        case 'replace_vehicle':
          data = { ...data, ...formData.vehicle };
          break;
        case 'remove_vehicle':
          const selectedVehicle = formData.policyDetails?.vehicles.find(
            v => v.id === formData.selectedVehicleId
          );
          data = {
            ...data,
            vehicleToRemove: selectedVehicle?.displayName || formData.vehicleToRemove,
            selectedVehicleId: formData.selectedVehicleId,
            removalReason: formData.removalReason,
            newOwnerInfo: formData.newOwnerInfo,
            isReplacing: formData.isReplacing,
            stillInPossession: formData.stillInPossession,
            outOfPossessionDate: formData.outOfPossessionDate,
          };
          break;
        case 'add_driver':
          data = { ...data, ...formData.driver };
          break;
        case 'remove_driver':
          const selectedDriver = formData.policyDetails?.drivers.find(
            d => d.id === formData.selectedDriverId
          );
          data = {
            ...data,
            driverToRemove: selectedDriver?.displayName || formData.driverToRemove,
            selectedDriverId: formData.selectedDriverId,
            removalReason: formData.driverRemovalReason,
          };
          break;
        case 'address_change':
          data = { ...data, ...formData.address };
          break;
        case 'add_mortgagee':
        case 'remove_mortgagee':
          data = { ...data, ...formData.mortgagee };
          break;
        case 'coverage_change':
          data = { ...data, ...formData.coverageChange };
          break;
        case 'cancel_policy':
          data = { ...data, ...formData.cancellation };
          break;
      }

      const res = await fetch('/api/policy-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyId: formData.policy?.id,
          policyNumber: formData.policy?.policyNumber,
          changeType: formData.changeType,
          data,
          assigneeId: selectedAssigneeId,
          assigneeName: selectedAssigneeName,
        }),
      });

      const result = await res.json();

      if (result.success) {
        localStorage.removeItem('serviceRequest_draft');
        alert(`Change request submitted!\n\nID: ${result.changeRequestId}\nAssigned to: ${selectedAssigneeName}\n${result.summary}`);
        router.push('/customers');
      } else {
        setErrors({ submit: result.error || 'Failed to submit request' });
      }
    } catch (e) {
      console.error(e);
      setErrors({ submit: 'Failed to submit request. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, router, validateCurrentStep]);

  const value: ServiceRequestWizardContextType = {
    currentStep,
    totalSteps: TOTAL_STEPS,
    goToStep,
    nextStep,
    prevStep,
    canGoNext: currentStep < TOTAL_STEPS - 1,
    canGoPrev: currentStep > 0,
    formData,
    updateField,
    updateNestedField,
    selectPolicy,
    selectChangeType,
    loadingPolicyDetails,
    errors,
    validateCurrentStep,
    submitRequest,
    isSubmitting,
    // Assignee selection
    showAssigneeModal,
    setShowAssigneeModal,
    assigneeId,
    assigneeName,
    handleAssigneeSelect,
    openAssigneeModal,
    submitWithAssignee,
  };

  return (
    <ServiceRequestWizardContext.Provider value={value}>
      <PrefillContext.Provider value={{ prefillQuery }}>
        {children}
      </PrefillContext.Provider>
    </ServiceRequestWizardContext.Provider>
  );
}
