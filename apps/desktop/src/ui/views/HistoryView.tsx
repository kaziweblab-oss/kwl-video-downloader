import { Panel, PanelHeader } from '../components/Panel';
import { Thumbnail } from '../components/Thumbnail';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { useTranslations } from '../hooks/useTranslations';
import type { DownloadHistoryEntry } from '../../native/tauriBridge';

export interface HistoryViewProps {
  history?: DownloadHistoryEntry[];
  onRetry?: (entry: DownloadHistoryEntry) => void;
  onDelete?: (entry: DownloadHistoryEntry) => void;
  onClearAll?: () => void;
  onOpenFile?: (path: string) => void;
  onRevealFile?: (path: string) => void;
  onRefresh?: () => void;
}

export const HistoryView = ({
  history = [],
  onRetry,
  onDelete,
  onClearAll,
  onOpenFile,
  onRevealFile,
  onRefresh,
}: HistoryViewProps) => {
  const t = useTranslations();

  if (history.length === 0) {
    return (
      <Panel>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <h3 className="m-0 text-lg font-bold tracking-tight">{t.recentDownloads}</h3>
            <span className="inline-flex min-h-6 items-center rounded-full border border-sky-300/25 bg-cyan-700/20 px-[0.55rem] py-[0.18rem] text-[0.7rem] font-bold text-sky-200">0 {t.items}</span>
          </div>
          <button
            type="button"
            onClick={() => onClearAll?.()}
            disabled
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-500 cursor-not-allowed opacity-60"
            title="Clear history"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="m6 7 1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></svg>
            Clear history
          </button>
        </div>

        <div className="mt-4 grid justify-items-center gap-2 px-3 pb-3 pt-5 text-center">
          <Icon name="empty" />
          <p className="mt-3.5 text-[0.95rem] text-slate-400">{t.emptyHistory}</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <h3 className="m-0 text-lg font-bold tracking-tight">{t.recentDownloads}</h3>
          <span className="inline-flex min-h-6 items-center rounded-full border border-sky-300/25 bg-cyan-700/20 px-[0.55rem] py-[0.18rem] text-[0.7rem] font-bold text-sky-200">{history.length} {t.items}</span>
        </div>
        <button
          type="button"
          onClick={() => onClearAll?.()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/25 bg-slate-900/70 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:border-red-400/70 hover:bg-red-500/20 hover:text-red-100"
          title="Clear history — Remove all"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="m6 7 1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></svg>
          Clear history
        </button>
      </div>

      <ul className="mt-4 grid list-none gap-3 p-0">
        {history.map((entry) => (
          <li
            key={`${entry.timestamp}-${entry.output_path ?? entry.filename ?? entry.format}`}
            className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-3 rounded-2xl border border-blue-400/20 bg-slate-900/70 p-3 shadow-[0_10px_24px_rgba(2,6,23,0.16)] max-[520px]:grid-cols-[60px_minmax(0,1fr)_auto]"
          >
            <Thumbnail src={entry.thumbnail ?? undefined} alt={entry.filename ?? entry.format} size="md" fallback={<span>{entry.format}</span>} />

            <div className="grid min-w-0 gap-1">
              <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-slate-50 text-sm">{entry.filename ?? entry.format}</strong>
              <span className="text-[0.78rem] text-slate-400">{entry.media_type} · {entry.format} {entry.resolution ? `· ${entry.resolution}` : ''} · {entry.status}</span>
              <span className="text-[0.7rem] text-slate-500 truncate">{entry.output_path ?? ''}</span>
            </div>

            <div className="flex items-center gap-1.5 self-center">
              {entry.status.toLowerCase() === 'completed' && entry.output_path && (
                <>
                  <IconButton variant="default" aria-label={t.openFile} title={t.openFile} onClick={() => onOpenFile?.(entry.output_path!)}>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  </IconButton>
                  <IconButton variant="default" aria-label={t.showInFolder} title={t.showInFolder} onClick={() => onRevealFile?.(entry.output_path!)}>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></svg>
                  </IconButton>
                </>
              )}
              {entry.status.toLowerCase() === 'failed' && (
                <IconButton variant="default" aria-label={t.retry} title={t.retry} onClick={() => onRetry?.(entry)}>
                  <Icon name="retry" />
                </IconButton>
              )}
              <IconButton variant="default" aria-label={t.delete} title={t.delete} onClick={() => onDelete?.(entry)}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="m6 7 1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></svg>
              </IconButton>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
};
