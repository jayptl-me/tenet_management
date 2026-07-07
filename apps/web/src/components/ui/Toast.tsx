'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle className="h-5 w-5" />,
  error: <XCircle className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
  info: <Info className="h-5 w-5" />,
};

const BORDER_COLORS: Record<ToastType, string> = {
  success: 'border-[color:var(--color-success-500)]',
  error: 'border-[color:var(--color-danger-500)]',
  warning: 'border-[color:var(--color-warning-500)]',
  info: 'border-[color:var(--color-brand-500)]',
};

const TEXT_COLORS: Record<ToastType, string> = {
  success: 'text-[color:var(--color-success-700)]',
  error: 'text-[color:var(--color-danger-700)]',
  warning: 'text-[color:var(--color-warning-700)]',
  info: 'text-[color:var(--color-brand-700)]',
};

const BG_COLORS: Record<ToastType, string> = {
  success: 'bg-[color:var(--color-success-50)]',
  error: 'bg-[color:var(--color-danger-50)]',
  warning: 'bg-[color:var(--color-warning-50)]',
  info: 'bg-[color:var(--color-brand-50)]',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 5000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);
      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {typeof window !== 'undefined' &&
        createPortal(
          <div
            className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2"
            aria-live="polite"
            aria-label="Notifications"
          >
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className={`pointer-events-auto animate-slide-in-left flex items-start gap-3 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] p-4 shadow-[var(--shadow-dropdown)] transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] max-w-[420px] ${BG_COLORS[toast.type]} ${BORDER_COLORS[toast.type]}`}
                role="alert"
              >
                <span className={`flex-shrink-0 ${TEXT_COLORS[toast.type]}`}>
                  {ICONS[toast.type]}
                </span>
                <p
                  className={`font-[family:var(--font-body)] flex-1 text-sm font-semibold leading-snug ${TEXT_COLORS[toast.type]}`}
                >
                  {toast.message}
                </p>
                <button
                  onClick={() => removeToast(toast.id)}
                  className={`flex-shrink-0 rounded-[var(--radius-md)] p-0.5 transition-opacity duration-[var(--transition-duration)] hover:opacity-70 ${TEXT_COLORS[toast.type]}`}
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function toastSuccess(message: string) {
  const event = new CustomEvent('pg-toast', {
    detail: { type: 'success' as ToastType, message },
  });
  window.dispatchEvent(event);
}

export function toastError(message: string) {
  const event = new CustomEvent('pg-toast', {
    detail: { type: 'error' as ToastType, message },
  });
  window.dispatchEvent(event);
}

/**
 * Global toast listener hook — instantiate once in app root.
 * Enables imperative toast calls from anywhere (e.g. in ky interceptors).
 */
export function useGlobalToastListener() {
  const { addToast } = useToast();

  if (typeof window === 'undefined') return;

  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail as { type: ToastType; message: string };
    if (detail?.type && detail?.message) {
      addToast(detail.type, detail.message);
    }
  };

  window.addEventListener('pg-toast', handler);
  return () => window.removeEventListener('pg-toast', handler);
}
