/**
 * useOptimisticMutation Hook
 * ==========================
 * Makes actions feel instant by updating UI immediately,
 * then syncing with server in the background.
 *
 * If the server request fails, reverts the optimistic update
 * and shows an error message.
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface OptimisticMutationOptions<T> {
  // Function to apply the optimistic update immediately
  optimisticUpdate: () => T;
  // The actual API call to make
  apiCall: () => Promise<any>;
  // Function to revert the optimistic update on error
  onRevert: (previousState: T) => void;
  // Optional success message
  successMessage?: string;
  // Optional error message (default: "Action failed. Please try again.")
  errorMessage?: string;
  // Optional callback on success
  onSuccess?: (response: any) => void;
  // Optional callback on error
  onError?: (error: any) => void;
}

export function useOptimisticMutation<T = any>() {
  const [isPending, setIsPending] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  const mutate = useCallback(async ({
    optimisticUpdate,
    apiCall,
    onRevert,
    successMessage,
    errorMessage = "Action failed. Please try again.",
    onSuccess,
    onError,
  }: OptimisticMutationOptions<T>) => {
    // 1. Capture previous state and apply optimistic update immediately
    const previousState = optimisticUpdate();
    setIsPending(true);

    // 2. Show success message immediately (optimistic)
    if (successMessage) {
      toast.success(successMessage);
    }

    // 3. Make API call in background
    try {
      const response = await apiCall();

      // Success - optimistic update was correct
      onSuccess?.(response);

      return { success: true, data: response };
    } catch (error: any) {
      // 4. Revert optimistic update on error
      setIsReverting(true);
      onRevert(previousState);
      setIsReverting(false);

      // Show error message
      toast.error(errorMessage);

      onError?.(error);

      return { success: false, error };
    } finally {
      setIsPending(false);
    }
  }, []);

  return { mutate, isPending, isReverting };
}

/**
 * useOptimisticList Hook
 * ======================
 * Specialized hook for optimistic updates on lists.
 * Provides helpers for common list operations.
 */
export function useOptimisticList<T extends { id: string }>(
  initialItems: T[],
  setItems: React.Dispatch<React.SetStateAction<T[]>>
) {
  const { mutate, isPending, isReverting } = useOptimisticMutation<T[]>();

  // Optimistically remove an item from the list
  const removeItem = useCallback(async (
    id: string,
    apiCall: () => Promise<any>,
    options?: {
      successMessage?: string;
      errorMessage?: string;
      onSuccess?: () => void;
    }
  ) => {
    return mutate({
      optimisticUpdate: () => {
        const previousItems = [...initialItems];
        setItems(prev => prev.filter(item => item.id !== id));
        return previousItems;
      },
      apiCall,
      onRevert: (previousItems) => setItems(previousItems),
      successMessage: options?.successMessage,
      errorMessage: options?.errorMessage,
      onSuccess: options?.onSuccess,
    });
  }, [mutate, initialItems, setItems]);

  // Optimistically update an item in the list
  const updateItem = useCallback(async (
    id: string,
    updates: Partial<T>,
    apiCall: () => Promise<any>,
    options?: {
      successMessage?: string;
      errorMessage?: string;
      onSuccess?: () => void;
    }
  ) => {
    return mutate({
      optimisticUpdate: () => {
        const previousItems = [...initialItems];
        setItems(prev => prev.map(item =>
          item.id === id ? { ...item, ...updates } : item
        ));
        return previousItems;
      },
      apiCall,
      onRevert: (previousItems) => setItems(previousItems),
      successMessage: options?.successMessage,
      errorMessage: options?.errorMessage,
      onSuccess: options?.onSuccess,
    });
  }, [mutate, initialItems, setItems]);

  // Optimistically add an item to the list
  const addItem = useCallback(async (
    newItem: T,
    apiCall: () => Promise<any>,
    options?: {
      successMessage?: string;
      errorMessage?: string;
      onSuccess?: (response: any) => void;
      position?: 'start' | 'end';
    }
  ) => {
    return mutate({
      optimisticUpdate: () => {
        const previousItems = [...initialItems];
        setItems(prev =>
          options?.position === 'end'
            ? [...prev, newItem]
            : [newItem, ...prev]
        );
        return previousItems;
      },
      apiCall,
      onRevert: (previousItems) => setItems(previousItems),
      successMessage: options?.successMessage,
      errorMessage: options?.errorMessage,
      onSuccess: options?.onSuccess,
    });
  }, [mutate, initialItems, setItems]);

  return {
    removeItem,
    updateItem,
    addItem,
    isPending,
    isReverting,
  };
}

export default useOptimisticMutation;
