export type VersionType = 'major' | 'minor' | 'patch' | 'build';

export interface VersionRecord {
  id: string;
  app_id: string;
  version: string;
  versionType: VersionType;
  releaseNotes: string;
  isLatest: boolean;
  isActive: boolean;
  created_at: string;
  download_url?: string | null;
  github_tag?: string | null;
}

export function isValidSemver(v: string): boolean {
  const parts = v.trim().split('.');
  if (parts.length !== 3) return false;
  return parts.every((p) => /^\d+$/.test(p));
}

export function parseGithubTag(tag: string): string | null {
  const t = tag.trim().replace(/^v/i, '');
  return isValidSemver(t) ? t : null;
}

export function versionTypeLabel(t: VersionType): string {
  switch (t) {
    case 'major': return 'Major';
    case 'minor': return 'Minor';
    case 'patch': return 'Patch';
    case 'build': return 'Build';
    default: return t;
  }
}

export function versionTypeColor(t: VersionType): string {
  switch (t) {
    case 'major': return 'bg-red-500/15 text-red-300 border-red-400/30';
    case 'minor': return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
    case 'patch': return 'bg-sky-500/15 text-sky-300 border-sky-400/30';
    case 'build': return 'bg-amber-500/15 text-amber-300 border-amber-400/30';
    default: return 'bg-slate-500/15 text-slate-300';
  }
}
