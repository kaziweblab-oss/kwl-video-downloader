import type { VersionRecord, VersionType } from './types';

const fallbackStore: VersionRecord[] = [];

type AddInput = {
  app_id: string;
  version: string;
  versionType: VersionType;
  releaseNotes?: string;
  isActive?: boolean;
  download_url?: string;
};

type UpdateInput = {
  id: string;
  versionType?: VersionType;
  releaseNotes?: string;
  isActive?: boolean;
  isLatest?: boolean;
  download_url?: string;
};

type GithubPayload = {
  tag_name: string;
  body?: string;
  html_url?: string;
  app_id?: string;
};

async function invokeTauri<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
  const tauriAvailable = '__TAURI_INTERNALS__' in globalThis;
  if (!tauriAvailable) throw new Error('Tauri unavailable');
  const { invoke } = await import('@tauri-apps/api/core');
  return (invoke as any)(command, payload);
}

export async function getVersions(appId?: string): Promise<VersionRecord[]> {
  try {
    return await invokeTauri<VersionRecord[]>('get_versions', { appId: appId ?? null });
  } catch {
    // browser fallback: localStorage
    try {
      const raw = localStorage.getItem('kwl:versions');
      const arr: VersionRecord[] = raw ? JSON.parse(raw) : fallbackStore;
      if (appId) return arr.filter((v) => v.app_id === appId);
      return arr;
    } catch {
      return fallbackStore;
    }
  }
}

export async function addVersion(input: AddInput): Promise<VersionRecord[]> {
  try {
    return await invokeTauri<VersionRecord[]>('add_version', { request: input });
  } catch {
    // fallback local
    const rec: VersionRecord = {
      id: `ver-${Date.now()}-${input.version.replace(/\./g, '-')}`,
      app_id: input.app_id,
      version: input.version,
      versionType: input.versionType,
      releaseNotes: input.releaseNotes ?? '',
      isLatest: true,
      isActive: input.isActive ?? true,
      created_at: new Date().toISOString(),
      download_url: input.download_url ?? null,
      github_tag: null,
    };
    const raw = localStorage.getItem('kwl:versions');
    const arr: VersionRecord[] = raw ? JSON.parse(raw) : [];
    // demote previous latest for same app
    arr.forEach((v) => { if (v.app_id === rec.app_id) v.isLatest = false; });
    arr.push(rec);
    localStorage.setItem('kwl:versions', JSON.stringify(arr));
    return arr.filter((v) => v.app_id === rec.app_id);
  }
}

export async function updateVersion(input: UpdateInput): Promise<VersionRecord[]> {
  try {
    return await invokeTauri<VersionRecord[]>('update_version', { request: input });
  } catch {
    const raw = localStorage.getItem('kwl:versions');
    const arr: VersionRecord[] = raw ? JSON.parse(raw) : [];
    const idx = arr.findIndex((v) => v.id === input.id);
    if (idx >= 0) {
      if (input.versionType) arr[idx]!.versionType = input.versionType;
      if (input.releaseNotes !== undefined) arr[idx]!.releaseNotes = input.releaseNotes;
      if (input.isActive !== undefined) arr[idx]!.isActive = input.isActive;
      if (input.isLatest) {
        const appId = arr[idx]!.app_id;
        arr.forEach((v) => { if (v.app_id === appId) v.isLatest = false; });
        arr[idx]!.isLatest = true;
      } else if (input.isLatest === false) {
        arr[idx]!.isLatest = false;
      }
      if (input.download_url !== undefined) arr[idx]!.download_url = input.download_url || null;
      localStorage.setItem('kwl:versions', JSON.stringify(arr));
      return arr.filter((v) => v.app_id === arr[idx]!.app_id);
    }
    return arr;
  }
}

export async function deleteVersion(id: string): Promise<VersionRecord[]> {
  try {
    return await invokeTauri<VersionRecord[]>('delete_version', { id });
  } catch {
    const raw = localStorage.getItem('kwl:versions');
    const arr: VersionRecord[] = raw ? JSON.parse(raw) : [];
    const idx = arr.findIndex((v) => v.id === id);
    const appId = arr[idx]?.app_id;
    if (idx >= 0) arr.splice(idx, 1);
    localStorage.setItem('kwl:versions', JSON.stringify(arr));
    return appId ? arr.filter((v) => v.app_id === appId) : arr;
  }
}

export async function syncGithubRelease(payload: GithubPayload): Promise<VersionRecord[]> {
  try {
    return await invokeTauri<VersionRecord[]>('sync_github_release', { payload });
  } catch {
    const tag = payload.tag_name.trim().replace(/^v/i, '');
    if (!/^\d+\.\d+\.\d+$/.test(tag)) throw new Error('Invalid tag');
    const notes = payload.body ?? '';
    // derive add via local addVersion
    const existingRaw = localStorage.getItem('kwl:versions');
    const existing: VersionRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
    const appId = payload.app_id ?? 'kwl-video-downloader';
    if (existing.some((v) => v.app_id === appId && v.version === tag)) {
      return existing.filter((v) => v.app_id === appId);
    }
    return addVersion({ app_id: appId, version: tag, versionType: 'patch', releaseNotes: notes, isActive: true, download_url: payload.html_url });
  }
}
