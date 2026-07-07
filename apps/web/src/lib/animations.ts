/**
 * Animation variants for use with the 'motion' library (Framer Motion successor).
 * Provides consistent micro-interaction patterns across the entire application.
 *
 * Usage:
 *   import { fadeScaleIn, staggerContainer } from '@/lib/animations';
 *   <motion.div variants={staggerContainer} initial="hidden" animate="visible">
 *     <motion.div variants={fadeScaleIn}>...</motion.div>
 *   </motion.div>
 */

import type { Variants, Transition } from 'motion/react';

// ── Transition Presets ────────────────────────────────

/** Snappy spring — buttons, toggles, small interactive elements */
export const transitionSpring: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
  mass: 0.8,
};

/** Gentle spring — cards, containers, larger surfaces */
export const transitionSpringGentle: Transition = {
  type: 'spring',
  stiffness: 350,
  damping: 38,
  mass: 0.9,
};

/** Fast tween — hover states, color changes, subtle shifts */
export const transitionTween: Transition = {
  type: 'tween',
  duration: 0.15,
  ease: [0.4, 0, 0.2, 1],
};

/** Medium tween — entrance animations, content transitions */
export const transitionTweenMed: Transition = {
  type: 'tween',
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1],
};

/** Slow tween — page transitions, modal reveals */
export const transitionTweenSlow: Transition = {
  type: 'tween',
  duration: 0.35,
  ease: [0.4, 0, 0.2, 1],
};

/** Snappy spring for drawers/sheets sliding in */
export const transitionDrawer: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 42,
  mass: 0.85,
};

/** Bouncy spring for celebratory/count animations */
export const transitionBounce: Transition = {
  type: 'spring',
  stiffness: 550,
  damping: 20,
  mass: 0.7,
};

// ── Variants: Fade & Scale ────────────────────────────

export const fadeScaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitionTweenMed,
  },
};

export const fadeScaleOut: Variants = {
  visible: { opacity: 1, scale: 1 },
  hidden: {
    opacity: 0,
    scale: 0.96,
    transition: transitionTween,
  },
};

// ── Variants: Directional Fade ────────────────────────

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitionTweenMed,
  },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitionTweenMed,
  },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitionTweenMed,
  },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitionTweenMed,
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitionSpringGentle,
  },
};

// ── Variants: Drawers & Modals ────────────────────────

/** Sidebar/drawer sliding in from left */
export const drawerLeft: Variants = {
  hidden: { x: '-100%', opacity: 0 },
  visible: {
    x: '0%',
    opacity: 1,
    transition: transitionDrawer,
  },
  exit: {
    x: '-100%',
    opacity: 0,
    transition: { type: 'tween', duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
};

/** Drawer sliding in from right */
export const drawerRight: Variants = {
  hidden: { x: '100%', opacity: 0 },
  visible: {
    x: '0%',
    opacity: 1,
    transition: transitionDrawer,
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { type: 'tween', duration: 0.2 },
  },
};

/** Modal overlay backdrop */
export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

/** Modal content panel */
export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: transitionSpringGentle,
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 8,
    transition: { type: 'tween', duration: 0.15 },
  },
};

// ── Variants: Tooltips & Popovers ─────────────────────

export const tooltip: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 600, damping: 35, mass: 0.7 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 2,
    transition: { duration: 0.1 },
  },
};

// ── Variants: Dropdowns ───────────────────────────────

export const dropdown: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 500, damping: 35, mass: 0.8 },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -2,
    transition: { duration: 0.1 },
  },
};

// ── Variants: Container (stagger children) ────────────

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.02,
    },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.08,
    },
  },
};

// ── Variants: List Item ───────────────────────────────

export const listItem: Variants = {
  hidden: { opacity: 0, x: -12, scale: 0.98 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: transitionTweenMed,
  },
  exit: {
    opacity: 0,
    x: -12,
    scale: 0.98,
    transition: { duration: 0.12 },
  },
};

// ── Variants: Card Hover ──────────────────────────────

export const cardHover = {
  rest: {
    y: 0,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
    borderColor: 'var(--border-color)',
    transition: transitionSpringGentle,
  },
  hover: {
    y: -2,
    boxShadow: '0 4px 16px rgba(99,102,241,0.1), 0 2px 4px rgba(0,0,0,0.06)',
    borderColor: 'var(--color-brand-200)',
    transition: transitionSpring,
  },
  tap: {
    y: 0,
    scale: 0.985,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    transition: { type: 'spring' as const, stiffness: 700, damping: 40 },
  },
};

// ── Variants: Bottom Sheet ────────────────────────────

export const bottomSheet: Variants = {
  hidden: { y: '100%', opacity: 0 },
  visible: {
    y: '0%',
    opacity: 1,
    transition: transitionDrawer,
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: { type: 'tween', duration: 0.25, ease: [0.4, 0, 0.2, 1] },
  },
};

// ── Variants: Skeleton Shimmer ────────────────────────

export const skeletonShimmer: Variants = {
  initial: {
    backgroundPosition: '200% 0',
  },
  animate: {
    backgroundPosition: '-200% 0',
    transition: {
      repeat: Infinity,
      duration: 1.8,
      ease: 'linear',
    },
  },
};

// ── Page Transitions ──────────────────────────────────

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: transitionTweenSlow,
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.15 },
  },
};

export const pageReveal: Variants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: transitionTweenSlow,
  },
  exit: {
    opacity: 0,
    scale: 0.99,
    transition: { duration: 0.12 },
  },
};

// ── Notification Bell ─────────────────────────────────

export const bellRing: Variants = {
  rest: { rotate: 0 },
  ring: {
    rotate: [0, -12, 10, -8, 6, -4, 0],
    transition: {
      duration: 0.5,
      ease: 'easeInOut',
    },
  },
};

// ── Collapsible Section ───────────────────────────────

export const collapse: Variants = {
  hidden: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
    transition: { type: 'tween', duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
  visible: {
    height: 'auto',
    opacity: 1,
    overflow: 'hidden',
    transition: { type: 'tween', duration: 0.25, ease: [0.4, 0, 0.2, 1] },
  },
};

// ── CSS Animation Class Names (for non-motion use) ────

export const ANIMATION_CLASSES = {
  fadeInUp: 'animate-fade-in-up',
  shimmer: 'animate-shimmer',
  slideInLeft: 'animate-slide-in-left',
  slideInRight: 'animate-slide-in-right',
  scaleIn: 'animate-scale-in',
  skeleton: 'animate-skeleton-pulse',
} as const;
