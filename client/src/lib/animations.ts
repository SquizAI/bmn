/**
 * Reusable Framer Motion variants and transition presets.
 * Import these in components for consistent micro-interactions.
 */
import type { Variants, Transition } from 'motion/react';

// ============================================================
// TRANSITIONS
// ============================================================

/** Snappy spring for button presses and toggles */
export const springSnap: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
};

/** Bouncy spring for celebratory moments */
export const springBounce: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 15,
};

/** Smooth ease for fades and slides */
export const easeSmooth: Transition = {
  duration: 0.3,
  ease: [0.22, 1, 0.36, 1],
};

/** Quick ease for micro-interactions */
export const easeQuick: Transition = {
  duration: 0.15,
  ease: 'easeOut',
};

// ============================================================
// BUTTON VARIANTS
// ============================================================

/** Hover + press scale effect for buttons */
export const buttonVariants: Variants = {
  idle: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.97 },
};

/** Icon button — slightly more pronounced */
export const iconButtonVariants: Variants = {
  idle: { scale: 1, rotate: 0 },
  hover: { scale: 1.1 },
  tap: { scale: 0.9 },
};

// ============================================================
// CARD VARIANTS
// ============================================================

/** Card lift on hover */
export const cardLiftVariants: Variants = {
  idle: {
    y: 0,
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
  },
  hover: {
    y: -4,
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
  },
};

/** Interactive card with border glow */
export const cardGlowVariants: Variants = {
  idle: {
    scale: 1,
    boxShadow: '0 0 0 0px rgba(184, 149, 106, 0)',
  },
  hover: {
    scale: 1.01,
    boxShadow: '0 0 0 1px rgba(184, 149, 106, 0.3)',
  },
  tap: {
    scale: 0.99,
  },
};

// ============================================================
// SELECTION VARIANTS
// ============================================================

/** Selection checkmark morph */
export const checkmarkVariants: Variants = {
  unchecked: {
    pathLength: 0,
    opacity: 0,
  },
  checked: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.3, ease: 'easeOut' },
      opacity: { duration: 0.1 },
    },
  },
};

/** Selection border glow */
export const selectionBorderVariants: Variants = {
  unselected: {
    borderColor: 'var(--bmn-color-border)',
    boxShadow: '0 0 0 0px rgba(184, 149, 106, 0)',
  },
  selected: {
    borderColor: 'var(--bmn-color-accent)',
    boxShadow: '0 0 0 2px rgba(184, 149, 106, 0.25)',
  },
};

// ============================================================
// ENTER / EXIT VARIANTS
// ============================================================

/** Fade + slide up for staggered lists */
export const fadeSlideUpVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

/** Stagger container for list children */
export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

/** Scale-in for modals and popovers */
export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

// ============================================================
// TOAST VARIANTS
// ============================================================

/** Toast slide-in from right */
export const toastVariants: Variants = {
  hidden: {
    opacity: 0,
    x: 100,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    x: 100,
    scale: 0.95,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};

// ============================================================
// WIZARD STEP TRANSITIONS
// ============================================================

/** Wizard step enter from right, exit to left */
export const wizardStepVariants: Variants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

// ============================================================
// GLOW / PULSE EFFECTS
// ============================================================

/** Subtle pulsing glow — for "something is happening" states */
export const pulseGlowVariants: Variants = {
  idle: {
    boxShadow: '0 0 0 0px rgba(184, 149, 106, 0)',
  },
  pulse: {
    boxShadow: [
      '0 0 0 0px rgba(184, 149, 106, 0.3)',
      '0 0 0 8px rgba(184, 149, 106, 0)',
    ],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeOut',
    },
  },
};
