import { useEffect, useRef } from 'react';

export interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export const Toast = ({ message, type, onClose, duration = 1100 }: ToastProps) => {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const timer = window.setTimeout(() => onCloseRef.current(), duration);
    return () => window.clearTimeout(timer);
  }, [duration]);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Blur backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[6px]"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Window */}
      <div
        role="alert"
        aria-live="assertive"
        className={`relative w-full max-w-[420px] rounded-2xl border bg-slate-900/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-[toastIn_0.22s_ease-out] ${type === 'success' ? 'border-emerald-400/30' : 'border-red-400/30'}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${type === 'success' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/20' : 'bg-red-500/15 text-red-300 border border-red-400/20'}`}
          >
            {type === 'success' ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v5" />
                <path d="M12 16h.01" />
              </svg>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[0.95rem] font-bold ${type === 'success' ? 'text-emerald-100' : 'text-red-100'}`}>
              {type === 'success' ? 'Success' : 'Failed'}
            </p>
            <p className="mt-1 text-[0.9rem] leading-5 text-slate-200 break-words">{message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(10px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};
