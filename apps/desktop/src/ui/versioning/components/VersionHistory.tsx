import type { VersionRecord } from '../types';
import { VersionBadge, LatestBadge } from './VersionBadge';

export const VersionHistory = ({
  versions,
  onDownload,
}: {
  versions: VersionRecord[];
  onDownload?: (v: VersionRecord) => void;
}) => {
  if (versions.length === 0) {
    return <p className="text-sm text-slate-400">No versions yet.</p>;
  }
  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <div
          key={v.id}
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${v.isActive ? 'border-slate-700/40 bg-slate-900/50' : 'border-slate-800/40 bg-slate-900/30 opacity-60'}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-sky-200">v{v.version}</span>
              <VersionBadge type={v.versionType} />
              {v.isLatest && <LatestBadge />}
              {!v.isActive && <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">Unpublished</span>}
            </div>
            {v.releaseNotes && <p className="mt-1 line-clamp-2 text-xs text-slate-300">{v.releaseNotes}</p>}
            <p className="mt-1 text-[11px] text-slate-500">{new Date(v.created_at).toLocaleDateString()} · {v.app_id}</p>
          </div>
          <button
            type="button"
            onClick={() => onDownload?.(v)}
            className="shrink-0 rounded-xl bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)] px-3 py-2 text-xs font-bold text-white hover:-translate-y-px transition disabled:opacity-50"
            disabled={!v.isActive}
          >
            Download
          </button>
        </div>
      ))}
    </div>
  );
};
