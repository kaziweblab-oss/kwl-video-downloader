import { useState } from 'react';
import { ReportModal } from './ReportModal';
import { useTranslations } from '../hooks/useTranslations';

export const ReportButton = () => {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
      >
        <span aria-hidden="true">📧</span>
        <span>{t.reportButton}</span>
      </button>
      <ReportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};