import { useState } from 'react';
import { Toast } from './Toast';
import { useReport, type ReportType } from '../hooks/useReport';
import { useTranslations } from '../hooks/useTranslations';

export interface ReportModalProps {
  open: boolean;
  onClose: () => void;
}

const REPORT_TYPES: { value: ReportType; label: (t: ReturnType<typeof useTranslations>) => string }[] = [
  { value: 'error', label: (t) => t.reportError },
  { value: 'suggestion', label: (t) => t.reportSuggestion },
  { value: 'feedback', label: (t) => t.reportFeedback },
];

export const ReportModal = ({ open, onClose }: ReportModalProps) => {
  const t = useTranslations();
  const { send, sending } = useReport();
  const [reportType, setReportType] = useState<ReportType>('error');
  const [message, setMessage] = useState('');
  const [includeInfo, setIncludeInfo] = useState(true);
  const [email, setEmail] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  if (!open) {
    return null;
  }

  const canSubmit = message.trim().length > 0 && !sending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await send(reportType, message, { includeInfo, email });
      setMessage('');
      setEmail('');
      setToast({ message: t.reportSuccess, type: 'success' });
      window.setTimeout(onClose, 1700);
    } catch {
      setToast({ message: t.reportFailed, type: 'error' });
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-[6px]"
          onClick={onClose}
          aria-hidden="true"
        />
        <div className="relative w-full max-w-[480px] overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900 shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <h3 className="text-base font-bold text-slate-100">{t.reportTitle}</h3>
              <p className="mt-1 text-xs text-slate-400">{t.reportType}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-slate-100"
              aria-label="Close"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="max-h-[65vh] overflow-y-auto p-5 space-y-5">
            <div>
              <div className="grid gap-2.5 grid-cols-3">
                {REPORT_TYPES.map((option) => {
                  const selected = reportType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setReportType(option.value)}
                      className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${selected ? 'border-sky-400 bg-sky-500/15 text-sky-100 shadow-[0_0_0_2px_rgba(56,189,248,0.25)]' : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:border-slate-600 hover:bg-slate-800'}`}
                    >
                      {option.label(t)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-2.5 block font-bold text-slate-300">{t.reportMessage}</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder={t.reportMessagePlaceholder}
                className="w-full resize-none rounded-xl border border-slate-400/40 bg-slate-950/70 px-4 py-3 text-slate-50 outline-none transition placeholder:text-slate-500 focus:border-sky-300/90 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.18)]"
              />
            </div>

            <div>
              <label className="mb-2.5 block font-bold text-slate-300">{t.reportEmail}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.reportEmailPlaceholder}
                className="w-full rounded-xl border border-slate-400/40 bg-slate-950/70 px-4 py-3 text-slate-50 outline-none transition placeholder:text-slate-500 focus:border-sky-300/90 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.18)]"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3 transition hover:bg-slate-800/70">
              <input
                type="checkbox"
                checked={includeInfo}
                onChange={(e) => setIncludeInfo(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-sky-400"
              />
              <span className="text-[0.9rem] text-slate-300">{t.reportAttachInfo}</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-900/80 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2 text-sm font-bold text-slate-300 transition hover:bg-slate-700 hover:text-slate-100"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-xl bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)] px-5 py-2 text-sm font-bold text-slate-50 shadow transition enabled:hover:-translate-y-px disabled:opacity-60 disabled:pointer-events-none"
            >
              {sending ? t.reportSending : t.reportSend}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={toast.type === 'success' ? 2000 : 2600}
        />
      )}
    </>
  );
};