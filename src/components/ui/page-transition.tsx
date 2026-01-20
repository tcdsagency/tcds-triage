'use client';

/**
 * Page Transition Component
 * =========================
 * Provides smooth page transition animations for better UX.
 * Uses CSS animations for performance without external dependencies.
 */

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  /** Animation type */
  type?: 'fade' | 'slide-up' | 'slide-left' | 'scale';
  /** Animation duration in ms */
  duration?: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PageTransition({
  children,
  className,
  type = 'fade',
  duration = 200,
}: PageTransitionProps) {
  const pathname = usePathname();
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Start exit animation
    setIsAnimating(true);

    // After half duration, swap content and start enter animation
    const timer = setTimeout(() => {
      setDisplayedChildren(children);
      // Small delay to ensure DOM updates before animation starts
      requestAnimationFrame(() => {
        setIsAnimating(false);
      });
    }, duration / 2);

    return () => clearTimeout(timer);
  }, [pathname, children, duration]);

  const getAnimationClasses = () => {
    switch (type) {
      case 'fade':
        return isAnimating
          ? 'opacity-0'
          : 'opacity-100';
      case 'slide-up':
        return isAnimating
          ? 'opacity-0 translate-y-4'
          : 'opacity-100 translate-y-0';
      case 'slide-left':
        return isAnimating
          ? 'opacity-0 translate-x-4'
          : 'opacity-100 translate-x-0';
      case 'scale':
        return isAnimating
          ? 'opacity-0 scale-95'
          : 'opacity-100 scale-100';
      default:
        return '';
    }
  };

  return (
    <div
      className={cn(
        'transition-all ease-out',
        getAnimationClasses(),
        className
      )}
      style={{ transitionDuration: `${duration / 2}ms` }}
    >
      {displayedChildren}
    </div>
  );
}

// =============================================================================
// SIMPLE FADE IN (for initial load)
// =============================================================================

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 300,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        'transition-all ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        className
      )}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

// =============================================================================
// STAGGERED FADE IN (for lists)
// =============================================================================

export function StaggeredFadeIn({
  children,
  className,
  staggerDelay = 50,
  initialDelay = 0,
}: {
  children: React.ReactNode[];
  className?: string;
  staggerDelay?: number;
  initialDelay?: number;
}) {
  return (
    <>
      {React.Children.map(children, (child, index) => (
        <FadeIn
          key={index}
          delay={initialDelay + index * staggerDelay}
          className={className}
        >
          {child}
        </FadeIn>
      ))}
    </>
  );
}

// =============================================================================
// ANIMATE PRESENCE (for mounting/unmounting)
// =============================================================================

export function AnimatePresence({
  children,
  isVisible,
  className,
  type = 'fade',
  duration = 200,
}: {
  children: React.ReactNode;
  isVisible: boolean;
  className?: string;
  type?: 'fade' | 'slide-up' | 'slide-down' | 'scale';
  duration?: number;
}) {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [animationState, setAnimationState] = useState<'entering' | 'entered' | 'exiting' | 'exited'>(
    isVisible ? 'entered' : 'exited'
  );

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setAnimationState('entering');
      const timer = setTimeout(() => setAnimationState('entered'), 10);
      return () => clearTimeout(timer);
    } else {
      setAnimationState('exiting');
      const timer = setTimeout(() => {
        setAnimationState('exited');
        setShouldRender(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration]);

  if (!shouldRender) return null;

  const getClasses = () => {
    const isEntered = animationState === 'entered';

    switch (type) {
      case 'fade':
        return isEntered ? 'opacity-100' : 'opacity-0';
      case 'slide-up':
        return isEntered
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4';
      case 'slide-down':
        return isEntered
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-4';
      case 'scale':
        return isEntered
          ? 'opacity-100 scale-100'
          : 'opacity-0 scale-95';
      default:
        return '';
    }
  };

  return (
    <div
      className={cn('transition-all ease-out', getClasses(), className)}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

// =============================================================================
// MODAL TRANSITION
// =============================================================================

export function ModalTransition({
  children,
  isOpen,
  onExited,
}: {
  children: React.ReactNode;
  isOpen: boolean;
  onExited?: () => void;
}) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => setIsAnimating(true));
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        onExited?.();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onExited]);

  if (!shouldRender) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 transition-opacity duration-200',
          isAnimating ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Modal */}
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200',
          isAnimating
            ? 'opacity-100'
            : 'opacity-0'
        )}
      >
        <div
          className={cn(
            'transition-all duration-200 transform',
            isAnimating
              ? 'opacity-100 scale-100'
              : 'opacity-0 scale-95'
          )}
        >
          {children}
        </div>
      </div>
    </>
  );
}

// =============================================================================
// LIST ANIMATION WRAPPER
// =============================================================================

export function AnimatedListItem({
  children,
  className,
  index = 0,
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 30);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <div
      className={cn(
        'transition-all duration-200 ease-out',
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2',
        className
      )}
    >
      {children}
    </div>
  );
}

export default PageTransition;
