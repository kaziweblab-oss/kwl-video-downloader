import { Panel, PanelHeader } from './Panel';
import { useTranslations } from '../hooks/useTranslations';

export interface UrlPanelProps {
  url: string;
  onUrlChange: (url: string) => void;
  onPaste: () => void;
  onAnalyze: () => void;
  onClear: () => void;
  isLoading: boolean;
  analyzeEnabled: boolean;
  status: string;
  error: string | null;
}

export const UrlPanel = ({
  url,
  onUrlChange,
  onPaste,
  onAnalyze,
  onClear,
  isLoading,
  analyzeEnabled,
  status,
  error,
}: UrlPanelProps) => {
  const t = useTranslations();

  return (
    <Panel>
      <PanelHeader label="URL" count={null} action={<span className="text-[0.72rem] uppercase tracking-[0.12em] text-sky-300">{status}</span>} />
      <div className="flex flex-wrap items-stretch gap-3 max-[760px]:flex-col max-[760px]:gap-2">
        <div className="relative flex min-w-[240px] flex-1 items-center">
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://example.com/video"
            aria-label="Video URL"
            className="w-full min-w-[200px] flex-1 rounded-xl border border-slate-400/40 bg-slate-900/80 px-4 py-[0.9rem] text-slate-50 outline-none transition focus:border-sky-300/90 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.18)] pr-[92px]"
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-[10px] border border-sky-300/40 bg-cyan-700/30 px-[0.8rem] py-[0.45rem] text-xs font-bold text-sky-100 transition hover:bg-cyan-700/50"
            onClick={onPaste}
          >
            Paste
          </button>
        </div>
        <button
          type="button"
          className="bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)] px-[1.2rem] py-[0.9rem] text-slate-50 rounded-xl border border-transparent font-bold transition hover:-translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 max-[760px]:w-full max-[760px]:px-4 max-[760px]:py-[0.78rem]"
          onClick={onAnalyze}
          disabled={!analyzeEnabled}
        >
          {isLoading ? t.analyzing : t.analyze}
        </button>
        {url && (
          <button
            type="button"
            className="border-slate-400/30 bg-slate-800/90 px-[1.2rem] py-[0.9rem] text-slate-50 rounded-xl border border-transparent font-bold transition hover:-translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 max-[760px]:w-full max-[760px]:px-4 max-[760px]:py-[0.78rem]"
            onClick={onClear}
          >
            {t.clear}
          </button>
        )}
      </div>
      <div className="mt-4 mb-3 flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-500/10 px-3.5 py-2.5">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300 border border-sky-400/20">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4" />
            <path d="M12 18v4" />
            <path d="M4.93 4.93l2.83 2.83" />
            <path d="M16.24 16.24l2.83 2.83" />
            <path d="M2 12h4" />
            <path d="M18 12h4" />
            <path d="M4.93 19.07l2.83-2.83" />
            <path d="M16.24 7.76l2.83-2.83" />
          </svg>
        </span>
        <p className="text-[0.78rem] leading-4 font-medium text-sky-100">
          {t.autoDetectHint}
        </p>
      </div>
      {error ? (
        <p className="mt-3.5 text-[0.95rem] text-red-300">{error}</p>
      ) : (
        <p className="mt-3.5 text-[0.95rem] text-slate-400">{t.secureValidationHint}</p>
      )}
    </Panel>
  );
};