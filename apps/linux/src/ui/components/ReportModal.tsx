import { useState } from 'react';
import { Toast } from './Toast';
import { useReport, type ReportType } from '../hooks/useReport';
import { useTranslations, useLanguage } from '../hooks/useTranslations';
import { useSettings } from '../store/settingsStore';

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
  const { language } = useLanguage();
  const { resolvedTheme } = useSettings();
  const isDark = resolvedTheme === 'dark';
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
        <div className={`relative w-full max-w-[480px] overflow-hidden rounded-2xl border shadow-[0_20px_60px_rgba(0,0,0,0.4)] flex flex-col ${isDark ? 'border-slate-700/50 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <div className={`flex items-center justify-between border-b px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div>
              <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t.reportTitle}</h3>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.reportType}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-xl border p-2 transition ${isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-slate-900'}`}
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
                      className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${selected ? (isDark ? 'border-sky-400 bg-sky-500/15 text-sky-100 shadow-[0_0_0_2px_rgba(56,189,248,0.25)]' : 'border-sky-500 bg-sky-50 text-sky-700 shadow-[0_0_0_2px_rgba(14,165,233,0.18)]') : (isDark ? 'border-slate-700 bg-slate-800/70 text-slate-300 hover:border-slate-600 hover:bg-slate-800' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white')}`}
                    >
                      {option.label(t)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={`mb-2.5 block font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.reportMessage}</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder={t.reportMessagePlaceholder}
                className={`w-full resize-none rounded-xl border px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-sky-300/90 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.18)] ${isDark ? 'border-slate-400/40 bg-slate-950/70 text-slate-50 placeholder:text-slate-500' : 'border-slate-300 bg-white text-slate-800'}`}
              />
            </div>

            <div>
              <label className={`mb-2.5 block font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.reportEmail}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.reportEmailPlaceholder}
                className={`w-full rounded-xl border px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-sky-300/90 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.18)] ${isDark ? 'border-slate-400/40 bg-slate-950/70 text-slate-50 placeholder:text-slate-500' : 'border-slate-300 bg-white text-slate-800'}`}
              />
              <p className={`mt-1.5 text-[11px] leading-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {language === 'bn' ? '🎁 Email দিলে reply + future offer পাবেন — ঐচ্ছিক, দ্রুত উত্তর পেতে সাহায্য করবে' : '🎁 Add email to get a reply & exclusive offer — optional, helps us respond faster'}
              </p>
            </div>

            {/* Attach diagnostic info hidden until KWL Nexus integration — will be re-added with Nexus */}
            {null}
          </div>

          <div className={`flex items-center justify-end gap-3 border-t px-5 py-3 ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50'}`}>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-xl border px-5 py-2 text-sm font-bold transition ${isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-xl bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)] px-5 py-2 text-sm font-bold text-white shadow transition enabled:hover:-translate-y-px disabled:opacity-60 disabled:pointer-events-none"
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