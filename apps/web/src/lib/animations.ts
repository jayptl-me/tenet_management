/**
 * Animation utility classes referenced across the app.
 * These are defined as @keyframes in globals.css and mapped
 * here for programmatic use where needed.
 */

export const ANIMATION_CLASSES = {
  fadeInUp: 'animate-fade-in-up',
  shimmer: 'animate-shimmer',
} as const;

/**
 * Tailwind-based animation class for slide-in from left.
 * Used by Sidebar mobile overlay.
 */
export const SLIDE_IN_LEFT = 'animate-slide-in-left';

/**
 * Slide-in-from-left keyframe definition (add to globals.css if not present).
 * @keyframes slide-in-left {
 *   from { transform: translateX(-100%); }
 *   to { transform: translateX(0); }
 * }
 */
