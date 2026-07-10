'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApiLoadingStore } from '@/store/apiLoading';

/**
 * Subtle top-bar loading indicator wired to useApiLoadingStore.
 * Shows a thin animated line at the very top of the admin layout
 * whenever API requests are in flight for >300ms.
 * This provides visual feedback without blocking the UI.
 */
export function GlobalLoadingBar() {
  const isSlowLoading = useApiLoadingStore((s) => s.isSlowLoading);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isSlowLoading) {
      // Small delay so quick requests don't flash the bar
      const timer = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [isSlowLoading]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed left-0 right-0 top-0 z-[9999] h-[2px] origin-left bg-[color:var(--color-brand-500)]"
          style={{ transformOrigin: 'left center' }}
        >
          {/* Animated shimmer */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
