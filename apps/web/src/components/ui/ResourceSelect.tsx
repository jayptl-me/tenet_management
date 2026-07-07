'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface ResourceOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface ResourceSelectProps {
  label?: string;
  endpoint: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  placeholder?: string;
  className?: string;
  /** Param name to use as the value from fetched data */
  valueKey?: string;
  /** Param name or function to derive the label */
  labelKey?: string | ((item: any) => string);
  /** Optional function to derive a sublabel */
  sublabelFn?: (item: any) => string;
  /** Data path in the response (e.g., 'data' for { success, data }) */
  dataPath?: string;
  disabled?: boolean;
}

export function ResourceSelect({
  label,
  endpoint,
  value,
  onChange,
  error,
  placeholder = 'Select...',
  className,
  valueKey = '_id',
  labelKey = 'label',
  sublabelFn,
  dataPath = 'data',
  disabled = false,
}: ResourceSelectProps) {
  const [options, setOptions] = useState<ResourceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    api
      .get(endpoint)
      .json<{ success: boolean; data: any[] }>()
      .then((res) => {
        if (cancelled) return;
        const data = dataPath ? (res as any)[dataPath] ?? res.data ?? [] : res.data ?? [];
        const items = Array.isArray(data) ? data : [];

        const mapped: ResourceOption[] = items.map((item: any) => {
          const val = item[valueKey]?.toString() ?? '';
          const lbl =
            typeof labelKey === 'function'
              ? labelKey(item)
              : (item[labelKey] ?? item.name ?? item.roomNumber ?? item.floorNumber ?? val);
          const sub = sublabelFn ? sublabelFn(item) : undefined;
          return { value: val, label: lbl, sublabel: sub };
        });

        setOptions(mapped);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFetchError('Failed to load options');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint, valueKey, labelKey, dataPath, sublabelFn]);

  const selectId = label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      {label && (
        <label htmlFor={selectId} className="text-surface-800 font-display text-sm font-semibold">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled || isLoading}
          className={`text-surface-900 font-body w-full appearance-none rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 pr-10 text-base transition-shadow focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-[color:var(--color-brand-500)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${error ? 'border-danger-500 focus:ring-danger-500' : ''}`}
        >
          <option value="">{isLoading ? 'Loading...' : placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
              {opt.sublabel ? ` (${opt.sublabel})` : ''}
            </option>
          ))}
        </select>
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="text-surface-400 h-4 w-4 animate-spin" />
          </div>
        )}
        {!isLoading && (
          <svg
            className="text-surface-500 pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>
      {fetchError && !isLoading && <p className="text-warning-600 text-xs font-medium">{fetchError}</p>}
      {error && <p className="text-danger-600 text-sm font-medium">{error}</p>}
    </div>
  );
}
