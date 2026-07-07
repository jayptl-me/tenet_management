'use client';

import { ErrorBoundary } from './ErrorBoundary';
import { ToastProvider, useGlobalToastListener } from '@/components/ui/Toast';

function ToastListener() {
  useGlobalToastListener();
  return null;
}

/**
 * Wraps all children with ToastProvider, ErrorBoundary, and global toast listener.
 * Import this in the root layout to provide error handling and toast notifications
 * across all pages without making the layout a client component.
 */
export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ToastListener />
        {children}
      </ToastProvider>
    </ErrorBoundary>
  );
}
