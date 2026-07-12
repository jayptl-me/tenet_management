'use client';

import { clsx } from 'clsx';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

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
  valueKey?: (keyof T & string) | string;
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

/**
 * API-backed select. Delegates to SearchableSelect for themed, searchable UI
 * (no native OS dropdown chrome).
 */
export function ResourceSelect<T extends Record<string, unknown> = Record<string, unknown>>({
  label,
  endpoint,
  value,
  onChange,
  error,
  helperText: _helperText,
  placeholder = 'Select...',
  className,
  valueKey = '_id',
  labelKey = 'label',
  sublabelFn,
  dataPath = 'data',
  disabled = false,
}: ResourceSelectProps<T>) {
  void _helperText;
  return (
    <div className={clsx(className)}>
      <SearchableSelect<T>
        label={label}
        endpoint={endpoint}
        value={value ?? ''}
        onChange={(v) => onChange?.(v)}
        error={error}
        placeholder={placeholder}
        valueKey={valueKey}
        labelKey={labelKey}
        sublabelFn={sublabelFn}
        dataPath={dataPath}
        disabled={disabled}
        clearable
      />
    </div>
  );
}
