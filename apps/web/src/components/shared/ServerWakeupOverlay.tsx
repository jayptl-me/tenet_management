'use client';

import { useApiLoadingStore } from '@/store/apiLoading';

export default function ServerWakeupOverlay() {
  const isSlowLoading = useApiLoadingStore((s) => s.isSlowLoading);

  if (!isSlowLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]">
      <div className="animate-fade-in-up mx-4 w-full max-w-md rounded-[var(--radius-xl)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-6 text-center shadow-[var(--shadow-card)]">
        {/* Loading Spinner */}
        <div className="bg-brand-100 mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]">
          <svg className="text-brand-600 h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>

        {/* Text Details */}
        <h3 className="font-display text-surface-900 mb-2 text-xl font-bold">
          Waking Up Server...
        </h3>
        <p className="font-body text-surface-600 text-sm leading-relaxed">
          Render&apos;s Free Tier container automatically goes to sleep after 15 minutes of
          inactivity. It can take about <strong>50–70 seconds</strong> to boot the server. Thank you
          for your patience!
        </p>

        {/* Shimmer Pulse Indicator */}
        <div className="mt-5 flex items-center justify-center gap-1.5">
          <span className="bg-brand-500 h-2 w-2 animate-pulse rounded-full" />
          <span className="text-brand-600 font-mono text-xs font-semibold uppercase tracking-wider">
            Connecting to MongoDB...
          </span>
        </div>
      </div>
    </div>
  );
}
