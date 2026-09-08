import { parseGithubTag } from './types';
import { syncGithubRelease } from './tauriVersionsBridge';

export interface GithubRelease {
  tag_name: string;
  body?: string | null;
  html_url?: string;
}

/**
 * Parses GitHub release tag `v1.0.0` → `1.0.0`, body → releaseNotes.
 * Returns null if tag invalid.
 */
export function parseReleaseToVersion(release: GithubRelease): { version: string; releaseNotes: string; tag: string } | null {
  const version = parseGithubTag(release.tag_name);
  if (!version) return null;
  return {
    version,
    releaseNotes: (release.body ?? '').trim(),
    tag: release.tag_name,
  };
}

/**
 * Auto-detect GitHub releases and sync as versions.
 * `fetchReleases` should return array of GithubRelease (e.g. from `https://api.github.com/repos/:owner/:repo/releases`).
 */
export async function autoSyncGithubReleases(releases: GithubRelease[], appId = 'kwl-video-downloader'): Promise<void> {
  for (const rel of releases) {
    const parsed = parseReleaseToVersion(rel);
    if (!parsed) continue;
    try {
      await syncGithubRelease({ tag_name: rel.tag_name, body: rel.body ?? undefined, html_url: rel.html_url, app_id: appId });
    } catch {
      // ignore individual failures
    }
  }
}

/**
 * Fetch releases from GitHub API (browser/Tauri). Returns typed releases.
 * Caller handles errors (rate limit / offline).
 */
export async function fetchGithubReleases(owner: string, repo: string): Promise<GithubRelease[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Offline — cannot fetch GitHub releases');
  }
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=20`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub fetch failed ${res.status}`);
  const data = (await res.json()) as Array<{ tag_name: string; body?: string | null; html_url?: string }>;
  return data.map((d) => ({ tag_name: d.tag_name, body: d.body ?? null, html_url: d.html_url }));
}
