import { useState } from 'react';
import type { VersionType } from '../types';
import { isValidSemver } from '../types';

export const VersionForm = ({
  appId,
  onSubmit,
  onCancel,
}: {
  appId: string;
  onSubmit: (data: { app_id: string; version: string; versionType: VersionType; releaseNotes: string; isActive: boolean; download_url?: string }) => Promise<void> | void;
  onCancel?: () => void;
}) => {
  const [version, setVersion] = useState('');
  const [versionType, setVersionType] = useState<VersionType>('patch');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!appId.trim()) { setError('App ID required'); return; }
    if (!isValidSemver(version)) { setError('Version must be MAJOR.MINOR.PATCH e.g. 1.0.2'); return; }
    setSubmitting(true);
    try {
      await onSubmit({ app_id: appId, version: version.trim(), versionType, releaseNotes: releaseNotes.trim(), isActive, download_url: downloadUrl.trim() || undefined });
      setVersion(''); setReleaseNotes(''); setDownloadUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-700/40 bg-slate-900/50 p-4">
      <h4 className="text-sm font-bold text-slate-200">Add new version — {appId}</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-300">Version (MAJOR.MINOR.PATCH)</label>
          <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.2" className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-sky-400" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-300">Version Type</label>
          <select value={versionType} onChange={(e) => setVersionType(e.target.value as VersionType)} className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-sky-400">
            <option value="major">Major — breaking change (v1→v2)</option>
            <option value="minor">Minor — new feature (v1.0→v1.1)</option>
            <option value="patch">Patch — bug fix (v1.0.0→v1.0.1)</option>
            <option value="build">Build — internal build</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold text-slate-300">Release Notes</label>
        <textarea value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} placeholder="What changed in this release…" rows={3} className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-sky-400" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold text-slate-300">Download URL (optional)</label>
        <input value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} placeholder="https://github.com/kwl/releases/download/v1.0.2/app.exe" className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-sky-400" />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-slate-600 bg-slate-800" />
        Publish (isActive) — uncheck to keep as draft / unpublish
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="rounded-xl bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {submitting ? 'Saving…' : 'Add Version'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-bold text-slate-300">Cancel</button>}
      </div>
    </form>
  );
};
