'use client';

import { useEffect, useCallback, useRef } from 'react';

// =============================================================================
// KEYBOARD NAVIGATION HOOK
// Provides keyboard shortcuts for efficient quote form navigation
// =============================================================================

interface UseKeyboardNavigationOptions {
  /** Callback when section jump is triggered (Ctrl+1-9) */
  onSectionJump?: (sectionIndex: number) => void;
  /** Callback when escape is pressed (collapse section) */
  onEscape?: () => void;
  /** Whether navigation is enabled */
  enabled?: boolean;
  /** Form container ref for scoping navigation */
  containerRef?: React.RefObject<HTMLElement>;
}

interface UseKeyboardNavigationReturn {
  /** Focus the next focusable element */
  focusNext: () => void;
  /** Focus the previous focusable element */
  focusPrevious: () => void;
  /** Focus a specific field by name */
  focusField: (fieldName: string) => void;
  /** Get all focusable elements in the form */
  getFocusableElements: () => HTMLElement[];
  /** Current focused element index */
  currentIndex: number;
}

// Selector for focusable form elements
const FOCUSABLE_SELECTOR = [
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled]):not([type="submit"])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
].join(', ');

export function useKeyboardNavigation(
  options: UseKeyboardNavigationOptions = {}
): UseKeyboardNavigationReturn {
  const {
    onSectionJump,
    onEscape,
    enabled = true,
    containerRef,
  } = options;

  const currentIndexRef = useRef(0);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    const container = containerRef?.current || document.body;
    const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    return Array.from(elements).filter((el) => {
      // Filter out hidden elements
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, [containerRef]);

  // Focus the next element
  const focusNext = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length === 0) return;

    const currentElement = document.activeElement as HTMLElement;
    const currentIdx = elements.indexOf(currentElement);
    const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % elements.length;

    elements[nextIdx]?.focus();
    currentIndexRef.current = nextIdx;
  }, [getFocusableElements]);

  // Focus the previous element
  const focusPrevious = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length === 0) return;

    const currentElement = document.activeElement as HTMLElement;
    const currentIdx = elements.indexOf(currentElement);
    const prevIdx = currentIdx === -1 ? 0 : (currentIdx - 1 + elements.length) % elements.length;

    elements[prevIdx]?.focus();
    currentIndexRef.current = prevIdx;
  }, [getFocusableElements]);

  // Focus a specific field by name attribute
  const focusField = useCallback((fieldName: string) => {
    const container = containerRef?.current || document.body;
    const element = container.querySelector<HTMLElement>(
      `[name="${fieldName}"], [data-field="${fieldName}"]`
    );
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [containerRef]);

  // Handle keyboard events
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      const isTextarea = tagName === 'textarea';
      const isInput = tagName === 'input';
      const isSelect = tagName === 'select';

      // Ctrl/Cmd + number for section jumping
      if ((event.ctrlKey || event.metaKey) && event.key >= '1' && event.key <= '9') {
        event.preventDefault();
        const sectionIndex = parseInt(event.key) - 1;
        onSectionJump?.(sectionIndex);
        return;
      }

      // Escape to collapse/deselect
      if (event.key === 'Escape') {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        onEscape?.();
        return;
      }

      // Enter to advance (but not in textarea or if holding Shift)
      if (event.key === 'Enter' && !event.shiftKey) {
        if (isInput && (target as HTMLInputElement).type !== 'checkbox') {
          event.preventDefault();
          focusNext();
          return;
        }
        // Allow Enter in select to open dropdown
        if (isSelect) {
          return;
        }
      }

      // Tab navigation is handled natively, but we track the index
      if (event.key === 'Tab') {
        // Update current index on next tick after focus changes
        setTimeout(() => {
          const elements = getFocusableElements();
          const currentElement = document.activeElement as HTMLElement;
          currentIndexRef.current = elements.indexOf(currentElement);
        }, 0);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onSectionJump, onEscape, focusNext, getFocusableElements]);

  return {
    focusNext,
    focusPrevious,
    focusField,
    getFocusableElements,
    currentIndex: currentIndexRef.current,
  };
}

export default useKeyboardNavigation;
