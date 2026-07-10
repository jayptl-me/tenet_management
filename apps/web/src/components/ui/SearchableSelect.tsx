'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { Search, ChevronDown, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';
import {
  fieldControlBase,
  fieldControlBorderError,
  fieldControlBorderOk,
  fieldErrorClass,
  fieldLabelClass,
} from '@/lib/field-styles';

interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps<T extends Record<string, unknown> = Record<string, unknown>> {
  label?: string;
  endpoint?: string;
  options?: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  className?: string;
  valueKey?: string;
  labelKey?: ((item: T) => string) | string;
  sublabelFn?: (item: T) => string;
  dataPath?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  /** When true, allows clearing the selection */
  clearable?: boolean;
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

export function SearchableSelect<T extends Record<string, unknown> = Record<string, unknown>>({
  label,
  endpoint,
  options: staticOptions,
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
  searchPlaceholder = 'Search...',
  clearable = false,
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<SearchableOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch from endpoint if provided, otherwise use static options
  useEffect(() => {
    if (staticOptions) {
      setOptions(staticOptions);
      return;
    }
    if (!endpoint) return;

    let cancelled = false;
    setIsLoading(true);
    setFetchError('');

    api
      .get(endpoint)
      .json<unknown>()
      .then((res) => {
        if (cancelled) return;
        const raw = getByPath(res, dataPath);
        const items = Array.isArray(raw) ? raw : [];

        const mapped: SearchableOption[] = items.map((item) => {
          const record = item as T;
          const val = String(record[valueKey] ?? '');
          const lbl =
            typeof labelKey === 'function'
              ? labelKey(record)
              : String(record[labelKey] ?? record.name ?? record.roomNumber ?? val);
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
  }, [endpoint, valueKey, dataPath, staticOptions, labelKey, sublabelFn]);

  // Filter options based on search
  const filtered = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      opt.sublabel?.toLowerCase().includes(search.toLowerCase()),
  );

  // Find selected label
  const selectedOption = options.find((opt) => opt.value === value);
  const selectedLabel = selectedOption?.label ?? '';

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setIsOpen(false);
      setSearch('');
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange('');
    setSearch('');
  }, [onChange]);

  const selectId = `searchable-${label?.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={clsx('flex flex-col gap-1.5', className)} ref={containerRef}>
      {label && (
        <label htmlFor={selectId} className={fieldLabelClass}>
          {label}
        </label>
      )}

      <div className="relative">
        {/* Trigger button */}
        <button
          type="button"
          id={selectId}
          disabled={disabled}
          onClick={() => {
            if (!disabled) setIsOpen(!isOpen);
            if (!isOpen) setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className={clsx(
            fieldControlBase,
            'flex items-center gap-2 text-left',
            !value && 'text-[color:var(--color-text-muted)]',
            error ? fieldControlBorderError : fieldControlBorderOk,
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-describedby={error ? `${selectId}-error` : undefined}
        >
          {isLoading ? (
            <span className="flex items-center gap-2 text-[color:var(--color-text-muted)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading...
            </span>
          ) : (
            <span className="flex-1 truncate">{value ? selectedLabel : placeholder}</span>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {clearable && value && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="rounded p-0.5 transition-colors hover:bg-[color:var(--color-surface-200)]"
                aria-label="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className={clsx('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
          </div>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] shadow-[var(--shadow-dropdown)]">
            {/* Search */}
            <div className="relative border-b border-[color:var(--border-color)]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full border-0 bg-transparent py-2.5 pl-9 pr-3 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none"
                aria-label="Search options"
              />
            </div>

            {/* Options */}
            <div
              className="max-h-60 overflow-y-auto"
              role="listbox"
              aria-label={label ?? 'Options'}
            >
              {fetchError ? (
                <div className="px-3 py-6 text-center text-xs font-medium text-[color:var(--color-warning-600)]">
                  {fetchError}
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs font-medium text-[color:var(--color-text-muted)]">
                  {search ? 'No matching options' : 'No options available'}
                </div>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={opt.value === value}
                    onClick={() => handleSelect(opt.value)}
                    className={clsx(
                      'flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition-colors',
                      opt.value === value
                        ? 'bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]'
                        : 'text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-field-bg)]',
                    )}
                  >
                    <span className="font-medium">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-xs text-[color:var(--color-text-muted)]">
                        {opt.sublabel}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p id={`${selectId}-error`} className={fieldErrorClass} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
