import { Panel, PanelHeader } from './Panel';
import { Thumbnail } from './Thumbnail';
import { useTranslations } from '../hooks/useTranslations';
import { Icon } from './Icon';
import type { AnalysisState } from '../downloadFlow';

export interface AnalyzedMediaListProps {
  analyses: AnalysisState[];
  selectedMediaIds: string[];
  activeMediaId: string | null;
  onMediaCardSelect: (analysisId: string) => void;
  onRemoveAnalysis: (analysisId: string) => void;
  onRemoveSelection: () => void;
  onMarkAll?: () => void;
  onUnmarkAll?: () => void;
  onClearAll?: () => void;
  activeMediaCount: number;
}

export const AnalyzedMediaList = ({
  analyses,
  selectedMediaIds,
  activeMediaId,
  onMediaCardSelect,
  onRemoveAnalysis,
  onRemoveSelection,
  onMarkAll,
  onUnmarkAll,
  onClearAll,
  activeMediaCount,
}: AnalyzedMediaListProps) => {
  const t = useTranslations();
  const isSelected = (id: string) => selectedMediaIds.includes(id);

  return (
    <Panel className="flex h-full min-h-[280px] flex-col">
      <div className="flex items-center justify-between gap-3">
        <PanelHeader
          label={t.analyzedMedia}
          count={`${analyses.length} ${t.items}`}
          compact
        />
        {activeMediaCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[0.82rem] text-slate-400">{activeMediaCount} {t.items}</span>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-400/25 bg-slate-900/70 text-red-300 transition hover:border-red-400/70 hover:bg-red-500/20 hover:text-red-100 hover:shadow-[0_0_16px_rgba(239,68,68,0.18)]"
              onClick={onRemoveSelection}
              aria-label={t.removeSelection}
              title={t.removeSelection}
            >
              <svg className="h-[18px] w-[18px] fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16" />
                <path d="M9 7V5h6v2" />
                <path d="m6 7 1 13h10l1-13" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>
        )}
      </div>
      {analyses.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onMarkAll?.()}
            disabled={activeMediaCount === analyses.length}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${activeMediaCount === analyses.length ? 'border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-60' : 'border-sky-400/30 bg-sky-600/20 text-sky-200 hover:bg-sky-600/30'}`}
            title="Mark all"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
            Mark All
          </button>
          <button
            type="button"
            onClick={() => onUnmarkAll?.()}
            disabled={activeMediaCount === 0}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${activeMediaCount === 0 ? 'border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-60' : 'border-slate-400/30 bg-slate-700/40 text-slate-200 hover:bg-slate-600/50'}`}
            title="Unmark all"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9l6 6M15 9l-6 6" /></svg>
            Unmark All
          </button>
          <button
            type="button"
            onClick={() => onClearAll?.()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:border-red-400/30 hover:bg-red-600/20 hover:text-red-200"
            title="Clear analyzed media"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
            Clear All
          </button>
        </div>
      )}
      {analyses.length === 0 ? (
        <div className="grid justify-items-center gap-2 px-3 pb-3 pt-5 text-center">
          <Icon name="empty" />
          <p className="mt-3.5 text-[0.95rem] text-slate-400">{t.emptyAnalysis}</p>
        </div>
      ) : (
        <div className="mt-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
          <ul className="m-0 grid list-none gap-3 p-0 max-[520px]:grid-cols-[auto_1fr]">
            {analyses.map((entry) => {
              const selected = isSelected(entry.id);
              return (
                <li
                  key={entry.id}
                  className={`
                    grid cursor-pointer gap-[14px] rounded-2xl border p-[14px] shadow-[0_10px_24px_rgba(2,6,23,0.16)]
                    transition hover:border-sky-300/50 hover:shadow-[0_10px_24px_rgba(2,6,23,0.3)]
                    max-[520px]:grid-cols-[auto_60px_minmax(0,1fr)_auto]
                    max-[520px]:gap-2.5 max-[520px]:p-3
                    ${selected
                      ? 'grid-cols-[auto_64px_minmax(0,1fr)_auto] border-sky-300/90 bg-slate-900/70 border-blue-400/20 shadow-[0_0_0_1px_rgba(125,211,252,0.45),0_10px_24px_rgba(2,6,23,0.24)]'
                      : 'grid-cols-[auto_64px_minmax(0,1fr)_auto] border-blue-400/20 bg-slate-900/70'
                    }
                  `}
                  onClick={() => onMediaCardSelect(entry.id)}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    aria-label={t.mark}
                    title={t.mark}
                    className={`
                      inline-flex h-[22px] w-[22px] shrink-0 cursor-pointer items-center justify-center rounded border-2 transition
                      ${selected
                        ? 'border-sky-400 bg-sky-500 text-white shadow-[0_0_0_2px_rgba(56,189,248,0.25)]'
                        : 'border-slate-500 bg-slate-800/80 text-transparent hover:border-slate-400 hover:bg-slate-700'
                      }
                    `}
                    onClick={(e) => { e.stopPropagation(); onMediaCardSelect(entry.id); }}
                  >
                    <svg
                      className={`h-[13px] w-[13px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] ${selected ? 'opacity-100 stroke-[2.6]' : 'opacity-0'}`}
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="m5 12 5 5L20 7" />
                    </svg>
                  </button>

                  <Thumbnail
                    src={entry.thumbnail}
                    alt={entry.title}
                    size="md"
                    fallback={<span>{t.mediaFallback}</span>}
                  />

                  <div className="grid min-w-0 gap-1">
                    <strong className="flex min-w-0 items-center overflow-hidden text-ellipsis whitespace-nowrap text-slate-50">
                      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{entry.title}</span>
                    </strong>
                    <span className="text-[0.82rem] text-slate-400">
                      {entry.author} · {entry.duration} · {entry.sourceUrl ? new URL(entry.sourceUrl).hostname : 'Unknown'}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-slate-400/25 bg-slate-900/70 p-0 text-slate-300 transition hover:border-red-400/70 hover:bg-red-500/20 hover:text-red-100 hover:shadow-[0_0_16px_rgba(239,68,68,0.18)]"
                    onClick={(e) => { e.stopPropagation(); onRemoveAnalysis(entry.id); }}
                    aria-label={t.remove}
                    title={t.remove}
                  >
                    <svg className="h-[15px] w-[15px] fill-none stroke-current stroke-[2] [stroke-linecap:round]" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18 6L6 18" />
                      <path d="M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
};