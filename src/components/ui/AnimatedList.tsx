'use client';

/**
 * Animated List Component
 * =======================
 * Provides smooth animations for list items using Framer Motion.
 * Items fade in when added and slide out when removed.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

interface AnimatedListProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  // Animation variants
  animationVariant?: 'fade' | 'slide' | 'scale' | 'slideUp';
  // Stagger delay between items (in seconds)
  staggerDelay?: number;
  // Custom layout for the container
  layout?: 'grid' | 'list';
  gridClassName?: string;
}

// Animation variants for list items
const variants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 100 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
};

export function AnimatedList<T>({
  items,
  keyExtractor,
  renderItem,
  className,
  animationVariant = 'slide',
  staggerDelay = 0.05,
  layout = 'list',
  gridClassName = 'grid grid-cols-1 lg:grid-cols-2 gap-4',
}: AnimatedListProps<T>) {
  const variant = variants[animationVariant];
  const containerClass = layout === 'grid' ? gridClassName : className;

  return (
    <div className={containerClass}>
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={keyExtractor(item)}
            layout
            initial={variant.initial}
            animate={variant.animate}
            exit={variant.exit}
            transition={{
              duration: 0.2,
              delay: index * staggerDelay,
              layout: { duration: 0.2 },
            }}
          >
            {renderItem(item, index)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Animated Item Wrapper
 * =====================
 * Wrap individual items for animation when not using AnimatedList.
 */
interface AnimatedItemProps {
  children: ReactNode;
  className?: string;
  variant?: 'fade' | 'slide' | 'scale' | 'slideUp';
  delay?: number;
}

export function AnimatedItem({
  children,
  className,
  variant = 'slideUp',
  delay = 0,
}: AnimatedItemProps) {
  const variantConfig = variants[variant];

  return (
    <motion.div
      initial={variantConfig.initial}
      animate={variantConfig.animate}
      exit={variantConfig.exit}
      transition={{ duration: 0.2, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated Modal Wrapper
 * ======================
 * Provides smooth scale-in animation for modals and dialogs.
 */
interface AnimatedModalProps {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
  onBackdropClick?: () => void;
}

export function AnimatedModal({
  isOpen,
  children,
  className,
  onBackdropClick,
}: AnimatedModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onBackdropClick}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className={className}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Animated Number
 * ===============
 * Smoothly animates number changes (counts up/down).
 */
interface AnimatedNumberProps {
  value: number;
  className?: string;
  formatFn?: (value: number) => string;
}

export function AnimatedNumber({
  value,
  className,
  formatFn = (v) => Math.round(v).toLocaleString(),
}: AnimatedNumberProps) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {formatFn(value)}
    </motion.span>
  );
}

/**
 * Animated Button
 * ===============
 * Button with hover and tap animations.
 */
interface AnimatedButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export function AnimatedButton({
  children,
  onClick,
  className,
  disabled,
  type = 'button',
}: AnimatedButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      className={className}
    >
      {children}
    </motion.button>
  );
}

export default AnimatedList;
