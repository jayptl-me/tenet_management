'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import {
  fieldControlBase,
  fieldControlBorderError,
  fieldControlBorderOk,
  fieldErrorClass,
  fieldHelperClass,
  fieldLabelClass,
} from '@/lib/field-styles';

interface ResourceOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface ResourceSelectProps<T extends Record<string, unknown> = Record<string, unknown>> {
  label?: string;
  endpoint: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  className?: string;
  /** Param name to use as the value from fetched data */
  valueKey?: keyof T & string | string;
  /** Param name or function to derive the label */
  labelKey?: (keyof T & string) | string | ((item: T) => string);
  /** Optional function to derive a sublabel */
  sublabelFn?: (item: T) => string;
  /** Data path in the response (e.g., 'data' for { success, data }) */
  dataPath?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
}

function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function ResourceSelect<T extends Record<string, unknown> = Record<string, unknown>>({
  label,
  endpoint,
  value,
  onChange,
  error,
  helperText,
  placeholder = 'Select...',
  className,
  valueKey = '_id',
  labelKey = 'label',
  sublabelFn,
  dataPath = 'data',
  disabled = false,
  name,
  id,
}: ResourceSelectProps<T>) {
  const [options, setOptions] = useState<ResourceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setFetchError('');

    api
      .get(endpoint)
      .json<unknown>()
      .then((res) => {
        if (cancelled) return;
        const raw = getByPath(res, dataPath);
        const items = Array.isArray(raw)
          ? raw
          : Array.isArray((res as { data?: unknown }).data)
            ? ((res as { data: unknown[] }).data)
            : [];

        const mapped: ResourceOption[] = items.map((item) => {
          const record = item as T;
          const val = String(record[valueKey] ?? '');
          const lbl =
            typeof labelKey === 'function'
              ? labelKey(record)
              : String(
                  record[labelKey] ??
                    record.name ??
                    record.roomNumber ??
                    record.floorNumber ??
                    val,
                );
          const sub = sublabelFn ? sublabelFn(record) : undefined;
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
    // labelKey/sublabelFn may be inline functions; endpoint is the real dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, valueKey, dataPath]);

  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={selectId} className={fieldLabelClass}>
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          name={name}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled || isLoading}
          className={clsx(
            fieldControlBase,
            'appearance-none pr-9',
            error ? fieldControlBorderError : fieldControlBorderOk,
          )}
          aria-invalid={error ? true : undefined}
        >
          <option value="">{isLoading ? 'Loading...' : placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
              {opt.sublabel ? ` (${opt.sublabel})` : ''}
            </option>
          ))}
        </select>
        {isLoading ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-[color:var(--color-text-muted)]" />
          </div>
        ) : (
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
        )}
      </div>
      {fetchError && !isLoading && (
        <p className="text-[12px] font-medium text-[color:var(--color-warning-600)]">{fetchError}</p>
      )}
      {error && (
        <p className={fieldErrorClass} role="alert">
          {error}
        </p>
      )}
      {helperText && !error && !fetchError && (
        <p className={fieldHelperClass}>{helperText}</p>
      )}
    </div>
  );
}
