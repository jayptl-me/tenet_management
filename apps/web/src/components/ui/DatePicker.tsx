'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { clsx } from 'clsx';
import * as Popover from '@radix-ui/react-popover';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  fieldControlBase,
  fieldControlBorderError,
  fieldControlBorderOk,
  fieldErrorClass,
  fieldHelperClass,
  fieldHintClass,
  fieldLabelClass,
} from '@/lib/field-styles';

// ── Types ──────────────────────────────────────────────

export interface DatePickerProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'onChange' | 'value' | 'defaultValue' | 'min' | 'max'
  > {
  value?: string;
  defaultValue?: string;
  onChange?: ((value: string) => void) | ((e: React.ChangeEvent<HTMLInputElement>) => void);
  label?: string;
  error?: string;
  helperText?: string;
  hint?: string;
  placeholder?: string;
  type?: 'date' | 'month';
  min?: string | number;
  max?: string | number;
  clearable?: boolean;
  leftIcon?: React.ReactNode;
  className?: string;
}

// ── Constants & Helpers ────────────────────────────────

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function padZero(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function getTodayString(type: 'date' | 'month'): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = padZero(d.getMonth() + 1);
  if (type === 'month') return `${y}-${m}`;
  return `${y}-${m}-${padZero(d.getDate())}`;
}

function formatDisplay(value: string, type: 'date' | 'month'): string {
  if (!value) return '';
  if (type === 'month') {
    const parts = value.split('-');
    if (parts.length >= 2) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${MONTH_SHORT[monthIdx]} ${year}`;
      }
    }
    return value;
  }
  const parts = value.split('-');
  if (parts.length >= 3) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
      return `${day} ${MONTH_SHORT[monthIdx]} ${year}`;
    }
  }
  return value;
}

// ── Component ──────────────────────────────────────────

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      value: valueProp,
      defaultValue,
      onChange,
      label,
      error,
      helperText,
      hint,
      placeholder,
      type = 'date',
      min,
      max,
      clearable = true,
      leftIcon,
      className,
      id,
      name,
      disabled = false,
      required,
      'aria-label': ariaLabel,
      ...rest
    },
    ref,
  ) => {
    const autoId = useId();
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-') ?? autoId;
    const minStr = min !== undefined && min !== null ? String(min) : undefined;
    const maxStr = max !== undefined && max !== null ? String(max) : undefined;
    const nativeRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => nativeRef.current as HTMLInputElement);

    const isControlled = valueProp !== undefined;
    const [uncontrolled, setUncontrolled] = useState(String(defaultValue ?? ''));
    const [open, setOpen] = useState(false);

    // Sync from RHF reset() which sets native input value via ref
    useEffect(() => {
      const el = nativeRef.current;
      if (!el || isControlled) return;
      const sync = () => setUncontrolled(el.value);
      const t = window.setTimeout(sync, 0);
      el.addEventListener('change', sync);
      return () => {
        window.clearTimeout(t);
        el.removeEventListener('change', sync);
      };
    }, [isControlled]);

    const current = isControlled ? String(valueProp ?? '') : uncontrolled;

    // View state for popover calendar (year, month)
    const initialDate = current ? new Date(current.length === 7 ? `${current}-01` : current) : new Date();
    const validInitial = isNaN(initialDate.getTime()) ? new Date() : initialDate;
    const [viewYear, setViewYear] = useState<number>(validInitial.getFullYear());
    const [viewMonth, setViewMonth] = useState<number>(validInitial.getMonth());

    // Update view when value changes and popover is closed
    useEffect(() => {
      if (!open && current) {
        const d = new Date(current.length === 7 ? `${current}-01` : current);
        if (!isNaN(d.getTime())) {
          setViewYear(d.getFullYear());
          setViewMonth(d.getMonth());
        }
      }
    }, [current, open]);

    const emitChange = useCallback(
      (next: string) => {
        const el = nativeRef.current;
        if (el) {
          el.value = next;
        }
        if (!isControlled) setUncontrolled(next);
        if (onChange && el) {
          const event = {
            ...new Event('change', { bubbles: true }),
            target: el,
            currentTarget: el,
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          Object.defineProperty(event, 'target', {
            writable: false,
            value: el,
          });
          try {
            (onChange as (e: React.ChangeEvent<HTMLInputElement>) => void)(event);
          } catch {
            (onChange as (val: string) => void)(next);
          }
        } else if (onChange) {
          (onChange as (val: string) => void)(next);
        }
      },
      [isControlled, onChange],
    );

    const handleSelectDay = (day: number) => {
      const formatted = `${viewYear}-${padZero(viewMonth + 1)}-${padZero(day)}`;
      emitChange(formatted);
      setOpen(false);
    };

    const handleSelectMonth = (monthIdx: number) => {
      const formatted = `${viewYear}-${padZero(monthIdx + 1)}`;
      emitChange(formatted);
      setOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      emitChange('');
    };

    const handlePrev = () => {
      if (type === 'month') {
        setViewYear((y) => y - 1);
      } else {
        if (viewMonth === 0) {
          setViewMonth(11);
          setViewYear((y) => y - 1);
        } else {
          setViewMonth((m) => m - 1);
        }
      }
    };

    const handleNext = () => {
      if (type === 'month') {
        setViewYear((y) => y + 1);
      } else {
        if (viewMonth === 11) {
          setViewMonth(0);
          setViewYear((y) => y + 1);
        } else {
          setViewMonth((m) => m + 1);
        }
      }
    };

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const today = getTodayString('date');
    const thisMonth = getTodayString('month');

    const defaultPlaceholder = type === 'month' ? 'Select month...' : 'Select date...';
    const displayValue = formatDisplay(current, type);

    return (
      <div className={clsx('flex flex-col gap-1.5', className)}>
        {label && (
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={inputId} className={fieldLabelClass}>
              {label}
              {required ? (
                <span className="ml-0.5 text-[color:var(--color-danger-600)]">*</span>
              ) : null}
            </label>
            {hint && <span className={fieldHintClass}>{hint}</span>}
          </div>
        )}

        {/* Hidden native input for RHF register/ref/reset */}
        <input
          ref={nativeRef}
          id={inputId}
          name={name}
          type="hidden"
          value={current}
          defaultValue={defaultValue}
          disabled={disabled}
          required={required}
          {...rest}
        />

        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              id={`${inputId}-trigger`}
              disabled={disabled}
              className={clsx(
                fieldControlBase,
                'flex items-center justify-between gap-2 text-left',
                !current && 'text-[color:var(--color-text-muted)]',
                error ? fieldControlBorderError : fieldControlBorderOk,
              )}
              aria-label={ariaLabel || label || defaultPlaceholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={
                error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
              }
            >
              <span className="flex items-center gap-2 truncate">
                {leftIcon ? (
                  <span className="text-[color:var(--color-text-muted)] [&_svg]:h-4 [&_svg]:w-4">
                    {leftIcon}
                  </span>
                ) : (
                  <CalendarIcon className="h-4 w-4 shrink-0 text-[color:var(--color-text-muted)]" />
                )}
                <span className="truncate">{displayValue || placeholder || defaultPlaceholder}</span>
              </span>

              <div className="flex shrink-0 items-center gap-1">
                {clearable && current && !disabled && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={handleClear}
                    onKeyDown={(e) => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
                    className="rounded p-0.5 text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-surface-200)] hover:text-[color:var(--color-text-primary)]"
                    aria-label="Clear date"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={4}
              className="z-50 w-72 rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-3 shadow-[var(--shadow-dropdown)] outline-none"
            >
              {/* Header */}
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="rounded-[var(--radius-md)] p-1.5 text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-field-bg)] hover:text-[color:var(--color-text-primary)]"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="text-sm font-bold text-[color:var(--color-text-primary)]">
                  {type === 'month' ? viewYear : `${MONTH_NAMES[viewMonth]} ${viewYear}`}
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-[var(--radius-md)] p-1.5 text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-field-bg)] hover:text-[color:var(--color-text-primary)]"
                  aria-label="Next"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Day Grid View */}
              {type === 'date' && (
                <div>
                  <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[color:var(--color-text-muted)]">
                    {DAY_NAMES.map((d) => (
                      <div key={d} className="h-7 flex items-center justify-center">
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-8" />
                    ))}

                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = `${viewYear}-${padZero(viewMonth + 1)}-${padZero(day)}`;
                      const isSelected = current === dateStr;
                      const isToday = today === dateStr;
                      const isPastMin = minStr && dateStr < minStr;
                      const isFutureMax = maxStr && dateStr > maxStr;
                      const isDayDisabled = isPastMin || isFutureMax;

                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={Boolean(isDayDisabled)}
                          onClick={() => handleSelectDay(day)}
                          className={clsx(
                            'h-8 w-full rounded-[var(--radius-md)] text-xs font-medium transition-colors',
                            isSelected
                              ? 'bg-[color:var(--color-brand-500)] text-[color:var(--color-text-inverted)] font-bold shadow-[var(--shadow-xs)]'
                              : isToday
                                ? 'border border-[color:var(--color-brand-500)] font-bold text-[color:var(--color-brand-600)] hover:bg-[color:var(--color-field-bg)]'
                                : 'text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-field-bg)]',
                            isDayDisabled && 'opacity-30 pointer-events-none',
                          )}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  {/* Shortcuts */}
                  <div className="mt-3 flex items-center justify-between border-t border-[color:var(--border-color)] pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        emitChange(today);
                        setOpen(false);
                      }}
                      className="text-xs font-semibold text-[color:var(--color-brand-600)] hover:underline"
                    >
                      Today
                    </button>
                    {current && (
                      <button
                        type="button"
                        onClick={() => {
                          emitChange('');
                          setOpen(false);
                        }}
                        className="text-xs font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Month Grid View */}
              {type === 'month' && (
                <div>
                  <div className="grid grid-cols-3 gap-2">
                    {MONTH_SHORT.map((m, idx) => {
                      const monthStr = `${viewYear}-${padZero(idx + 1)}`;
                      const isSelected = current === monthStr;
                      const isThisMonth = thisMonth === monthStr;
                      const isPastMin = minStr && monthStr < minStr.slice(0, 7);
                      const isFutureMax = maxStr && monthStr > maxStr.slice(0, 7);
                      const isMonthDisabled = isPastMin || isFutureMax;

                      return (
                        <button
                          key={m}
                          type="button"
                          disabled={Boolean(isMonthDisabled)}
                          onClick={() => handleSelectMonth(idx)}
                          className={clsx(
                            'h-9 rounded-[var(--radius-md)] text-xs font-medium transition-colors',
                            isSelected
                              ? 'bg-[color:var(--color-brand-500)] text-[color:var(--color-text-inverted)] font-bold shadow-[var(--shadow-xs)]'
                              : isThisMonth
                                ? 'border border-[color:var(--color-brand-500)] font-bold text-[color:var(--color-brand-600)] hover:bg-[color:var(--color-field-bg)]'
                                : 'text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-field-bg)]',
                            isMonthDisabled && 'opacity-30 pointer-events-none',
                          )}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>

                  {/* Shortcuts */}
                  <div className="mt-3 flex items-center justify-between border-t border-[color:var(--border-color)] pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        emitChange(thisMonth);
                        setOpen(false);
                      }}
                      className="text-xs font-semibold text-[color:var(--color-brand-600)] hover:underline"
                    >
                      This Month
                    </button>
                    {current && (
                      <button
                        type="button"
                        onClick={() => {
                          emitChange('');
                          setOpen(false);
                        }}
                        className="text-xs font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {error && (
          <p id={`${inputId}-error`} className={fieldErrorClass} role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className={fieldHelperClass}>
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

DatePicker.displayName = 'DatePicker';
