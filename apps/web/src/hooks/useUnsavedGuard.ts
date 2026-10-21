'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Warns when navigating away with unsaved form changes (Next.js route
 * changes, reload, back/forward). Does not block in-app Link clicks via
 * router.push — pages pair this with a beforeunload-grade guard on their
 * cancel buttons instead.
 */
export function useUnsavedGuard(isDirty: boolean): void {
  const dirtyRef = useRef(isDirty);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

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
 *
 * String targets navigate client-side via router.push for internal paths
 * (rooted or relative), keeping a history entry and the Next transition;
 * absolute http(s) URLs still use window.location.assign, which needs a full
 * document load. When does the confirm fire is unchanged: only when the hook
 * was constructed with isDirty true.
 */
export function useUnsavedGuardState(isDirty: boolean): UnsavedGuardState {
  const [guardOpen, setGuardOpen] = useState(false);
  const pendingRef = useRef<string | (() => void) | null>(null);
  const router = useRouter();

  const navigate = useMemo(
    () => (target: string) => {
      if (/^https?:\/\//i.test(target)) {
        window.location.assign(target);
        return;
      }
      router.push(target);
    },
    [router],
  );

  return useMemo(
    () => ({
      isDirty,
      guardOpen,
      confirmLeave: () => {
        const target = pendingRef.current;
        pendingRef.current = null;
        setGuardOpen(false);
        if (typeof target === 'function') target();
        else if (target) navigate(target);
      },
      requestLeave: (target: string | (() => void)) => {
        if (!isDirty) {
          if (typeof target === 'function') target();
          else navigate(target);
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
    [isDirty, guardOpen, navigate],
  );
}
