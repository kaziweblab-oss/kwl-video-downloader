import { Panel } from '../components/Panel';
import { Thumbnail } from '../components/Thumbnail';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { useTranslations } from '../hooks/useTranslations';
import type { CartItem } from '../App';

export interface QueueViewProps {
  cart?: CartItem[];
  onStartItem?: (id: string) => void;
  onPauseItem?: (id: string) => void;
  onResumeItem?: (id: string) => void;
  onRemoveItem?: (id: string) => void;
  onPauseAll?: () => void;
  onResumeAll?: () => void;
  onCancelAll?: () => void;
  onClearQueue?: () => void;
  onClearCompleted?: () => void;
  onOpenFile?: (path: string) => void;
  onRevealFile?: (path: string) => void;
}

export const QueueView = ({
  cart = [],
  onStartItem,
  onPauseItem,
  onResumeItem,
  onRemoveItem,
  onPauseAll,
  onResumeAll,
  onCancelAll,
  onClearQueue,
  onOpenFile,
  onRevealFile,
}: QueueViewProps) => {
  const t = useTranslations();
  const pendingCount = cart.filter((item) =>
    ['Pending', 'Queued', 'Downloading', 'Paused', 'Converting', 'Processing', 'Validating'].includes(item.status)
  ).length;
  const hasDownloading = cart.some((item) => ['Downloading', 'Processing', 'Validating', 'Converting'].includes(item.status));
  const hasPaused = cart.some((item) => item.status === 'Paused');
  const hasActive = pendingCount > 0;

  const formatBytes = (bytes?: number | null): string | null => {
    if (bytes == null) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatSpeed = (bytesPerSec?: number | null): string | null => {
    if (bytesPerSec == null || bytesPerSec === 0) return null;
    const b = formatBytes(bytesPerSec);
    return b ? `${b}/s` : null;
  };

  const formatEta = (seconds?: number | null): string | null => {
    if (seconds == null) return null;
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (seconds < 3600) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}m ${s}s`;
  };

  // Canonical display progress helper — single source of truth (Part 5) — precise float for large files, handles downloaded>total
  const getDisplayProgress = (item: CartItem): { mode: 'determinate' | 'indeterminate'; percent: number | null; downloadedBytes: number | null; totalBytes: number | null; speed: number | null; eta: number | null; phase: string } => {
    const hasTotal = item.totalBytes != null && item.totalBytes > 0;
    let pct: number | null = null;
    let derived: number | null = null;
    if (hasTotal && item.downloadedBytes != null && item.totalBytes) derived = (item.downloadedBytes / item.totalBytes) * 100;
    if (hasTotal && item.percent != null) pct = item.percent;
    // If backend percent is stale 0 but derived is 131% (downloaded>total), use derived
    if (derived != null) {
      if (pct == null) pct = derived;
      else pct = Math.max(pct, derived);
    }
    if (pct != null) pct = Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
    // Completed always 100, Paused freezes, otherwise determinate only when hasTotal && pct != null and not in post-processing phases
    const isPostProcessing = ['Processing', 'Converting', 'Validating'].includes(item.status);
    const mode: 'determinate' | 'indeterminate' = hasTotal && pct != null && !isPostProcessing ? 'determinate' : hasTotal && item.status === 'Paused' && pct != null ? 'determinate' : hasTotal && item.status === 'Completed' ? 'determinate' : 'indeterminate';
    // For post-processing with hasTotal, we still want determinate at phase floor (92/98/100) but not indeterminate overlay
    const finalMode: 'determinate' | 'indeterminate' = (() => {
      if (item.status === 'Completed') return 'determinate';
      if (item.status === 'Paused' && hasTotal && pct != null) return 'determinate';
      if (isPostProcessing) return hasTotal && pct != null ? 'determinate' : 'indeterminate';
      if (hasTotal && pct != null) return 'determinate';
      return 'indeterminate';
    })();
    return { mode: finalMode, percent: pct, downloadedBytes: item.downloadedBytes ?? null, totalBytes: item.totalBytes ?? null, speed: item.speed ?? null, eta: item.eta ?? null, phase: item.status };
  };

  const buildStatusLine = (item: CartItem): string => {
    const s = item.status;
    if (s === 'Queued' || s === 'Pending') {
      // Show analyzed size for queued items
      const tot = item.totalBytes ?? item.analyzedTotalBytes ?? item.analyzedTotalApprox ?? null;
      const sizeStr = formatBytes(tot);
      if (item.isApprox && sizeStr) return `Queued • Estimated size: ~${sizeStr}`;
      if (sizeStr) return t.queuedSize.replace('{size}', sizeStr);
      // estimated handled below
      if (item.totalBytes == null && item.analyzedTotalBytes == null && item.analyzedTotalApprox == null) return t.unknownQueuedSize;
      return t.queued;
    }
    if (s === 'Converting') return t.converting;
    if (s === 'Processing') return t.processing;
    if (s === 'Validating') return t.validating;
    if (s === 'Completed') return t.completed;
    if (s === 'Failed') return item.error ? `${t.failed} · ${item.error}` : t.failed;
    if (s === 'Cancelled') return t.cancelled;
    if (s === 'Paused') {
      const dp = getDisplayProgress(item);
      const parts: string[] = ['Paused'];
      if (dp.percent != null) parts.push(`${dp.percent}%`);
      const dl = formatBytes(dp.downloadedBytes);
      const tot = formatBytes(dp.totalBytes);
      if (dl && tot) parts.push(`${dl} / ${tot}`);
      else if (dl) parts.push(`${dl} downloaded`);
      return parts.join(' • ');
    }
    // Downloading — show real percent before speed (no 99 cap, professional)
    const dp = getDisplayProgress(item);
    const pctStr = dp.percent != null ? `${dp.percent}%` : null;
    const speed = formatSpeed(dp.speed);
    const dl = formatBytes(dp.downloadedBytes);
    const tot = formatBytes(dp.totalBytes);
    const etaVal = formatEta(dp.eta);
    const eta = etaVal ? `ETA ${etaVal}` : null;
    const bytesPart = dl && tot ? `${dl} / ${tot}` : dl ? `${dl} downloaded` : null;
    // Order: percent • speed • bytes • ETA  (percent before speed as requested)
    const parts: (string | null)[] = [pctStr, speed, bytesPart, eta].filter(Boolean) as string[];
    if (parts.length === 0) {
      // indeterminate but downloading
      return dl ? `Downloading • ${dl} downloaded` : 'Downloading...';
    }
    return parts.join(' • ');
  };

  if (cart.length === 0) {
    return (
      <Panel>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <h3 className="m-0 text-lg font-bold tracking-tight">Queue</h3>
            <span className="inline-flex min-h-6 items-center rounded-full border border-sky-300/25 bg-cyan-700/20 px-[0.55rem] py-[0.18rem] text-[0.7rem] font-bold text-sky-200">0 {t.items}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h3 className="m-0 text-lg font-bold tracking-tight">Download pending</h3>
            <span className="inline-flex min-h-6 items-center rounded-full border border-amber-400/25 bg-amber-700/20 px-[0.55rem] py-[0.18rem] text-[0.7rem] font-bold text-amber-200">0 pending</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onPauseAll?.()} disabled={!hasDownloading} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${hasDownloading ? 'border-amber-400/30 bg-amber-600/20 text-amber-200 hover:bg-amber-600/30' : 'border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-60'}`}><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg> Pause All</button>
          <button type="button" onClick={() => onResumeAll?.()} disabled={!hasPaused} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${hasPaused ? 'border-emerald-400/30 bg-emerald-600/20 text-emerald-200 hover:bg-emerald-600/30' : 'border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-60'}`}><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg> Resume All</button>
          <button type="button" onClick={() => onCancelAll?.()} disabled={!hasActive} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${hasActive ? 'border-red-400/30 bg-red-600/20 text-red-200 hover:bg-red-600/30' : 'border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-60'}`}><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg> Cancel All</button>
          <button type="button" onClick={() => onClearQueue?.()} disabled={cart.length === 0} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${cart.length > 0 ? 'border-slate-400/30 bg-slate-700/40 text-slate-200 hover:bg-slate-600/50 hover:text-white' : 'border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-60'}`}><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="m6 7 1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></svg> Clear Queue</button>
        </div>
        <div className="grid justify-items-center gap-2 px-3 pb-3 pt-5 text-center"><Icon name="empty" /><p className="mt-3.5 text-[0.95rem] text-slate-400">{t.queueEmpty}</p></div>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5"><h3 className="m-0 text-lg font-bold tracking-tight">Queue</h3><span className="inline-flex min-h-6 items-center rounded-full border border-sky-300/25 bg-cyan-700/20 px-[0.55rem] py-[0.18rem] text-[0.7rem] font-bold text-sky-200">{cart.length} {t.items}</span></div>
        <div className="flex items-center gap-2.5"><h3 className="m-0 text-lg font-bold tracking-tight">Download pending</h3><span className="inline-flex min-h-6 items-center rounded-full border border-amber-400/25 bg-amber-700/20 px-[0.55rem] py-[0.18rem] text-[0.7rem] font-bold text-amber-200">{pendingCount} pending</span></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onPauseAll?.()} disabled={!hasDownloading} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${hasDownloading ? 'border-amber-400/30 bg-amber-600/20 text-amber-200 hover:bg-amber-600/30' : 'border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-60'}`}><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg> Pause All</button>
        <button type="button" onClick={() => onResumeAll?.()} disabled={!hasPaused} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${hasPaused ? 'border-emerald-400/30 bg-emerald-600/20 text-emerald-200 hover:bg-emerald-600/30' : 'border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-60'}`}><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg> Resume All</button>
        <button type="button" onClick={() => onCancelAll?.()} disabled={!hasActive} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${hasActive ? 'border-red-400/30 bg-red-600/20 text-red-200 hover:bg-red-600/30' : 'border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-60'}`}><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg> Cancel All</button>
        <button type="button" onClick={() => onClearQueue?.()} disabled={cart.length === 0} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${cart.length > 0 ? 'border-slate-400/30 bg-slate-700/40 text-slate-200 hover:bg-slate-600/50 hover:text-white' : 'border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-60'}`}><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="m6 7 1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></svg> Clear Queue</button>
      </div>

      <ul className="mt-4 grid list-none gap-3 p-0">
        {cart.map((item) => {
          const isPureDownloading = item.status === 'Downloading';
          const isPaused = item.status === 'Paused';
          const isQueued = item.status === 'Queued' || item.status === 'Pending';
          const isFailed = item.status === 'Failed';
          const isCompleted = item.status === 'Completed';
          // For polling/buttons, broad downloading includes post-processing phases
          const isDownloadingBroad = item.status === 'Downloading' || item.status === 'Processing' || item.status === 'Validating' || item.status === 'Converting';
          const display = getDisplayProgress(item);
          const showDeterminate = display.mode === 'determinate';
          const showIndeterminate = display.mode === 'indeterminate';
          const progress = display.percent ?? 0;
          const statusLine = buildStatusLine(item);

          return (
            <li key={item.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-3 rounded-2xl border border-blue-400/20 bg-slate-900/70 p-3 shadow-[0_10px_24px_rgba(2,6,23,0.16)] max-[520px]:grid-cols-[60px_minmax(0,1fr)_auto] max-[520px]:gap-2.5">
              <Thumbnail src={item.thumbnail} alt={item.title} size="md" fallback={<span>{t.mediaFallback}</span>} />
              <div className="grid min-w-0 gap-1">
                <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-slate-50 text-sm">{item.title}</strong>
                <span className="text-[0.78rem] text-slate-400">{item.format} · {item.quality} {item.selectedDimension ? `· ${item.selectedDimension.width}×${item.selectedDimension.height}` : ''} · {item.mediaType}</span>
                <span className="text-[0.78rem] text-slate-300">{statusLine}</span>
                {showDeterminate && (
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                    <div className={`h-full transition-all duration-500 ease-out ${isPaused ? 'bg-amber-400' : 'bg-sky-400'}`} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                  </div>
                )}
                {showIndeterminate && (
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-700 relative">
                    <div className="h-full w-1/3 bg-sky-400 absolute inset-y-0" style={{ animation: 'shimmer 1.2s ease-in-out infinite' }} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 self-center">
                {isQueued && (<IconButton variant="default" aria-label={t.startDownload} title={t.startDownload} onClick={() => onStartItem?.(item.id)}><svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></IconButton>)}
                {isDownloadingBroad && (<IconButton variant="default" aria-label={t.pause} title={t.pause} onClick={() => onPauseItem?.(item.id)}><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg></IconButton>)}
                {isPaused && (<IconButton variant="default" aria-label={t.resume} title={t.resume} onClick={() => onResumeItem?.(item.id)}><svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></IconButton>)}
                {isFailed && (<IconButton variant="default" aria-label={t.retry} title={t.retry} onClick={() => onStartItem?.(item.id)}><Icon name="retry" /></IconButton>)}
                {isCompleted && item.outputPath && (<><IconButton variant="default" aria-label={t.openFile} title={t.openFile} onClick={() => onOpenFile?.(item.outputPath!)}><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg></IconButton><IconButton variant="default" aria-label={t.showInFolder} title={t.showInFolder} onClick={() => onRevealFile?.(item.outputPath!)}><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></svg></IconButton></>)}
                <IconButton variant="default" aria-label={t.remove} title={t.remove} onClick={() => onRemoveItem?.(item.id)}><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="m6 7 1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></svg></IconButton>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
};
