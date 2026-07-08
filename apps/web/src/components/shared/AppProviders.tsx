'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './ErrorBoundary';
import { ToastProvider, useGlobalToastListener } from '@/components/ui/Toast';

function ToastListener() {
  useGlobalToastListener();
  return null;
}

/**
 * Wraps all children with QueryClientProvider, ToastProvider, ErrorBoundary,
 * and global toast listener. Import this in the root layout to provide
 * data fetching, error handling, and toast notifications across all pages
 * without making the layout a client component.
 */
export default function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <ToastProvider>
          <ToastListener />
          {children}
        </ToastProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
