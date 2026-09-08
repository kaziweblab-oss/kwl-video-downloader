import { useEffect, useState } from 'react';
import { Panel, PanelHeader } from './Panel';
import { useTranslations } from '../hooks/useTranslations';
import { useSettings } from '../store/settingsStore';

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
  lastAnalyzeResult?: null | { kind: 'single' | 'playlist'; count: number; label: string };
}

function AnimatedDots({ active }: { active: boolean }) {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setDots((d) => (d % 3) + 1), 420);
    return () => window.clearInterval(id);
  }, [active]);
  if (!active) return null;
  const text = '.'.repeat(dots);
  return <span className="inline-block min-w-[14px] text-left tabular-nums">{text}</span>;
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
  lastAnalyzeResult,
}: UrlPanelProps) => {
  const t = useTranslations();
  const { resolvedTheme } = useSettings();
  const isDark = resolvedTheme === 'dark';

  // Determine banner state
  const showAnalyzing = isLoading;
  const showError = !!error && !isLoading;
  const showSuccess = !!lastAnalyzeResult && !isLoading && !error;

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
            className={`w-full min-w-[200px] flex-1 rounded-xl border px-4 py-[0.9rem] outline-none transition focus:border-sky-300/90 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.18)] pr-[92px] ${isDark ? 'border-slate-400/40 bg-slate-900/80 text-slate-50' : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400'}`}
          />
          <button
            type="button"
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-[10px] border px-[0.8rem] py-[0.45rem] text-xs font-bold transition ${isDark ? 'border-sky-300/40 bg-cyan-700/30 text-sky-100 hover:bg-cyan-700/50' : 'border-sky-500 bg-sky-500 text-white hover:bg-sky-600'}`}
            onClick={onPaste}
          >
            Paste
          </button>
        </div>
        <button
          type="button"
          className="bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)] px-[1.2rem] py-[0.9rem] text-white rounded-xl border border-transparent font-bold transition hover:-translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 max-[760px]:w-full max-[760px]:px-4 max-[760px]:py-[0.78rem] shadow"
          onClick={onAnalyze}
          disabled={!analyzeEnabled}
        >
          {isLoading ? t.analyzing : t.analyze}
        </button>
        {url && (
          <button
            type="button"
            className={`px-[1.2rem] py-[0.9rem] rounded-xl border font-bold transition hover:-translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 max-[760px]:w-full max-[760px]:px-4 max-[760px]:py-[0.78rem] ${isDark ? 'border-slate-400/30 bg-slate-800/90 text-slate-50' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
            onClick={onClear}
          >
            {t.clear}
          </button>
        )}
      </div>

      {/* Auto-detect hint — always visible subtle */}
      <div className={`mt-4 flex items-center justify-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-center ${isDark ? 'border-sky-400/20 bg-sky-500/10' : 'border-sky-200 bg-sky-50'}`}>
        <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${isDark ? 'bg-sky-500/20 text-sky-300 border-sky-400/20' : 'bg-sky-100 text-sky-600 border-sky-200'}`}>
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
        <p className={`text-[0.78rem] leading-4 font-medium text-center ${isDark ? 'text-sky-100' : 'text-sky-700'}`}>
          {t.autoDetectHint}
        </p>
      </div>

      {/* Professional status banner — analyzing / error with Try Again / success type */}
      {showAnalyzing && (
        <div className={`mt-3 flex items-center gap-3 rounded-xl border px-4 py-3 ${isDark ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-emerald-300 bg-emerald-50'}`}>
          {/* round green spinning icon */}
          <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${isDark ? 'border-emerald-400/40 bg-emerald-500/15' : 'border-emerald-300 bg-emerald-100'}`}>
            <svg className="h-4 w-4 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path d="M12 3 a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold leading-tight ${isDark ? 'text-emerald-100' : 'text-emerald-700'}`}>
              {status.includes('playlist') || status.toLowerCase().includes('playlist') ? (isDark ? 'প্লেলিস্ট বিশ্লেষণ চলছে' : 'Analyzing playlist') : (isDark ? 'ভিডিও বিশ্লেষণ চলছে' : 'Analyzing video')}
              <AnimatedDots active={showAnalyzing} />
            </p>
            <p className={`text-xs ${isDark ? 'text-emerald-200/70' : 'text-emerald-600/80'}`}>{isDark ? 'লিংক যাচাই করা হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন' : 'Validating link — please wait'}</p>
          </div>
        </div>
      )}

      {showError && (
        <div className={`mt-3 flex items-center gap-3 rounded-xl border px-4 py-3 ${isDark ? 'border-red-500/25 bg-red-500/10' : 'border-red-300 bg-red-50'}`}>
          {/* round red icon */}
          <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${isDark ? 'border-red-400/40 bg-red-500/15 text-red-300' : 'border-red-300 bg-red-100 text-red-600'}`}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" />
              <path d="M12 16h.01" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold leading-tight ${isDark ? 'text-red-200' : 'text-red-700'}`}>{error}</p>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-red-300/70' : 'text-red-600/70'}`}>{isDark ? 'লিংক/নেটওয়ার্ক চেক করে আবার চেষ্টা করুন' : 'Check link or network and try again'}</p>
          </div>
          <button
            type="button"
            onClick={onAnalyze}
            className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-bold transition ${isDark ? 'border-red-400/40 bg-red-500/15 text-red-100 hover:bg-red-500/25' : 'border-red-300 bg-white text-red-600 hover:bg-red-50'}`}
          >
            Try Again
          </button>
        </div>
      )}

      {showSuccess && lastAnalyzeResult && (
        <div className={`mt-3 flex items-center gap-3 rounded-xl border px-4 py-3 ${isDark ? 'border-sky-400/20 bg-sky-500/10' : 'border-sky-200 bg-sky-50'}`}>
          <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${isDark ? 'border-sky-400/30 bg-sky-500/15 text-sky-300' : 'border-sky-300 bg-sky-100 text-sky-600'}`}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            {lastAnalyzeResult.kind === 'playlist' ? (
              <p className={`text-sm font-bold leading-tight truncate ${isDark ? 'text-sky-100' : 'text-sky-700'}`}>
                ✓ Playlist detected — {lastAnalyzeResult.count} video{lastAnalyzeResult.count > 1 ? 's' : ''} analyzed {lastAnalyzeResult.label ? `(${lastAnalyzeResult.label})` : ''}
              </p>
            ) : (
              <p className={`text-sm font-bold leading-tight truncate ${isDark ? 'text-sky-100' : 'text-sky-700'}`} title={lastAnalyzeResult.label}>
                ✓ Single video — “{lastAnalyzeResult.label.slice(0, 48)}{lastAnalyzeResult.label.length > 48 ? '…' : ''}” ready
              </p>
            )}
            <p className={`text-xs ${isDark ? 'text-sky-200/60' : 'text-sky-600/70'}`}>
              {lastAnalyzeResult.kind === 'playlist' ? (isDark ? 'প্লেলিস্ট লিংক বিশ্লেষণ সম্পন্ন' : 'Playlist link analyzed successfully') : (isDark ? 'ভিডিও লিংক বিশ্লেষণ সম্পন্ন' : 'Video link analyzed successfully')}
            </p>
          </div>
        </div>
      )}

      {!showAnalyzing && !showError && !showSuccess && (
        <p className={`mt-3 text-[0.95rem] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t.secureValidationHint}</p>
      )}
    </Panel>
  );
};