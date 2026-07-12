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
import { Check, ChevronDown } from 'lucide-react';
import * as RadixSelect from '@radix-ui/react-select';
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

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'children'
> {
  label?: string;
  error?: string;
  helperText?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
  leftIcon?: React.ReactNode;
}

// ── Component ──────────────────────────────────────────
// Themed Radix Select with a hidden native <select> so react-hook-form
// register() / reset() continue to work without Controller.

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      hint,
      options,
      placeholder = 'Select...',
      leftIcon,
      className,
      id,
      name,
      value: valueProp,
      defaultValue,
      disabled,
      required,
      onChange,
      onBlur,
      ...rest
    },
    ref,
  ) => {
    const autoId = useId();
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-') ?? autoId;
    const nativeRef = useRef<HTMLSelectElement>(null);
    useImperativeHandle(ref, () => nativeRef.current as HTMLSelectElement);

    const isControlled = valueProp !== undefined;
    const [uncontrolled, setUncontrolled] = useState(String(defaultValue ?? ''));

    // Sync from RHF reset() which sets native select value via ref
    useEffect(() => {
      const el = nativeRef.current;
      if (!el || isControlled) return;
      const sync = () => setUncontrolled(el.value);
      // RHF may set value after mount
      const t = window.setTimeout(sync, 0);
      el.addEventListener('change', sync);
      return () => {
        window.clearTimeout(t);
        el.removeEventListener('change', sync);
      };
    }, [isControlled]);

    const current = isControlled ? String(valueProp ?? '') : uncontrolled;
    // Radix Select forbids empty-string item values; map '' <-> sentinel
    const EMPTY = '__empty__';
    const radixValue = current === '' ? EMPTY : current;

    const emitNativeChange = useCallback(
      (rawNext: string) => {
        const next = rawNext === EMPTY ? '' : rawNext;
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
          } as unknown as React.ChangeEvent<HTMLSelectElement>;
          Object.defineProperty(event, 'target', {
            writable: false,
            value: el,
          });
          onChange(event);
        } else if (onChange) {
          onChange({
            target: { name, value: next },
          } as React.ChangeEvent<HTMLSelectElement>);
        }
      },
      [EMPTY, isControlled, name, onChange],
    );

    const selectedLabel = options.find((o) => o.value === current)?.label;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={selectId} className={fieldLabelClass}>
              {label}
              {required ? (
                <span className="ml-0.5 text-[color:var(--color-danger-600)]">*</span>
              ) : null}
            </label>
            {hint && <span className={fieldHintClass}>{hint}</span>}
          </div>
        )}

        {/* Hidden native select for RHF register/ref/reset */}
        <select
          ref={nativeRef}
          id={`${selectId}-native`}
          name={name}
          value={current}
          defaultValue={defaultValue}
          disabled={disabled}
          required={required}
          onChange={(e) => {
            if (!isControlled) setUncontrolled(e.target.value);
            onChange?.(e);
          }}
          onBlur={onBlur}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        <RadixSelect.Root
          value={radixValue}
          onValueChange={emitNativeChange}
          disabled={disabled}
        >
          <RadixSelect.Trigger
            id={selectId}
            aria-invalid={error ? true : undefined}
            className={clsx(
              fieldControlBase,
              'flex cursor-pointer items-center justify-between gap-2 text-left',
              leftIcon && 'pl-9',
              error ? fieldControlBorderError : fieldControlBorderOk,
              'data-[placeholder]:text-[color:var(--color-text-muted)]',
              className,
            )}
          >
            <span className="relative flex min-w-0 flex-1 items-center gap-2">
              {leftIcon && (
                <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)] [&_svg]:h-4 [&_svg]:w-4">
                  {leftIcon}
                </span>
              )}
              <span
                className={clsx(
                  'truncate',
                  !current && 'text-[color:var(--color-text-muted)]',
                )}
              >
                {selectedLabel ?? placeholder}
              </span>
            </span>
            <RadixSelect.Icon className="shrink-0 text-[color:var(--color-text-muted)]">
              <ChevronDown className="h-4 w-4" />
            </RadixSelect.Icon>
          </RadixSelect.Trigger>

          <RadixSelect.Portal>
            <RadixSelect.Content
              position="popper"
              sideOffset={4}
              className={clsx(
                'z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden',
                'rounded-[var(--radius-md)] border border-[color:var(--border-color)]',
                'bg-[color:var(--color-card-bg)] shadow-[var(--shadow-lg)]',
              )}
            >
              <RadixSelect.Viewport className="p-1">
                {options.map((opt) => (
                  <RadixSelect.Item
                    key={opt.value || EMPTY}
                    value={opt.value === '' ? EMPTY : opt.value}
                    disabled={opt.disabled}
                    className={clsx(
                      'relative flex cursor-pointer select-none items-center rounded-[var(--radius-sm)]',
                      'py-2 pl-8 pr-3 text-sm font-medium',
                      'text-[color:var(--color-text-primary)] outline-none',
                      'data-[highlighted]:bg-[color:var(--color-field-bg-hover)]',
                      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                    )}
                  >
                    <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
                      <RadixSelect.ItemIndicator>
                        <Check className="h-3.5 w-3.5 text-[color:var(--color-primary-600)]" />
                      </RadixSelect.ItemIndicator>
                    </span>
                    <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                  </RadixSelect.Item>
                ))}
              </RadixSelect.Viewport>
            </RadixSelect.Content>
          </RadixSelect.Portal>
        </RadixSelect.Root>

        {error && (
          <p className={fieldErrorClass} role="alert">
            {error}
          </p>
        )}
        {helperText && !error && <p className={fieldHelperClass}>{helperText}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
