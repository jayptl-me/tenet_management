'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Warns when navigating away with unsaved form changes (Next.js route
 * changes, reload, back/forward). Does not block in-app Link clicks via
 * router.push — pages pair this with a beforeunload-grade guard on their
 * cancel buttons instead.
 */
export function useUnsavedGuard(isDirty: boolean): void {
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      // Legacy requirement for the dialog to show in some browsers.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
}

export interface UnsavedGuardState {
  isDirty: boolean;
  guardOpen: boolean;
  confirmLeave: () => void;
  requestLeave: (target: string | (() => void)) => void;
  cancelLeave: () => void;
}

/**
 * Intercept-based guard for in-app navigation: pages call requestLeave()
 * from cancel buttons / nav actions; a confirm dialog decides.
 */
export function useUnsavedGuardState(isDirty: boolean): UnsavedGuardState {
  const [guardOpen, setGuardOpen] = useState(false);
  const pendingRef = useRef<string | (() => void) | null>(null);

  return useMemo(
    () => ({
      isDirty,
      guardOpen,
      confirmLeave: () => {
        const target = pendingRef.current;
        pendingRef.current = null;
        setGuardOpen(false);
        if (typeof target === 'function') target();
        else if (target) window.location.assign(target);
      },
      requestLeave: (target: string | (() => void)) => {
        if (!isDirty) {
          if (typeof target === 'function') target();
          else window.location.assign(target);
          return;
        }
        pendingRef.current = target;
        setGuardOpen(true);
      },
      cancelLeave: () => {
        pendingRef.current = null;
        setGuardOpen(false);
      },
    }),
    [isDirty, guardOpen],
  );
}
