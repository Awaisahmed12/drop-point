import React, { createContext, useContext, useState, useCallback } from 'react';
import { TOAST_SUCCESS_MS, TOAST_ERROR_MS } from '../../constants';

export type ToastType = 'error' | 'success' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

const ICONS: Record<ToastType, React.ReactNode> = {
  error: (
    <svg className="w-5 h-5 text-danger flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1 5h2v7h-2V7zm0 9h2v2h-2v-2z" />
    </svg>
  ),
  success: (
    <svg className="w-5 h-5 text-success flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.5 14.5l-4-4 1.41-1.41L10.5 13.67l6.09-6.09L18 9l-7.5 7.5z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-warning flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L1 21h22L12 2zm-1 7h2v6h-2V9zm0 8h2v2h-2v-2z" />
    </svg>
  ),
};

/**
 * Brief notices drop in from the top like an iOS banner: white, blurred,
 * one line, a glyph for the kind of message, and they leave on their own.
 */
export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, type === 'error' ? TOAST_ERROR_MS : TOAST_SUCCESS_MS);
  }, []);

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none"
          style={{ top: 'calc(var(--safe-top) + 10px)' }}
          aria-live="polite"
        >
          {toasts.map(toast => (
            <button
              key={toast.id}
              type="button"
              onClick={() => dismiss(toast.id)}
              className="glass flex items-center gap-3 px-4 py-3 rounded-full text-subhead font-medium text-ink text-left pointer-events-auto animate-sheet-up"
            >
              {ICONS[toast.type]}
              <span className="flex-1">{toast.message}</span>
            </button>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
