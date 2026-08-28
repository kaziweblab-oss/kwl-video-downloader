export type AppInfo = {
  name: string;
  version: string;
  platform: string;
  environment: string;
};

export type DownloadRequestPayload = {
  url: string;
  media_type: string;
  container: string;
  quality: string;
  output_directory: string;
  resolution?: string;
  fps?: number;
  transcode?: boolean;
  duration_seconds?: number;
  thumbnail?: string;
  video_size_bytes?: number | null;
  audio_size_bytes?: number | null;
  total_size_bytes?: number | null;
  size_known?: boolean | null;
};

export type DownloadJobStatus = {
  id: string;
  status: string;
  output_path?: string | null;
  filename?: string | null;
  percent?: number | null;
  downloaded_bytes?: number | null;
  total_bytes?: number | null;
  speed_bytes_per_second?: number | null;
  eta_seconds?: number | null;
  error?: string | null;
};

export type DownloadHistoryEntry = {
  filename?: string | null;
  media_type: string;
  format: string;
  resolution?: string | null;
  status: string;
  timestamp: string;
  output_path?: string | null;
  thumbnail?: string | null;
  url?: string | null;
};

export function buildFallbackAnalysisResponse(url: string): string {
  const safeUrl = url || 'https://example.com/video';

  return JSON.stringify({
    title: 'Example video preview',
    author: 'Source media',
    duration: '5m 42s',
    available: true,
    videoFormats: ['MP4', 'WEBM'],
    audioFormats: ['MP3', 'M4A'],
    videoResolutions: [
      { label: '1080p', width: 1920, height: 1080 },
      { label: '720p', width: 1280, height: 720 },
      { label: '480p', width: 854, height: 480 },
      { label: '360p', width: 640, height: 360 },
      { label: '144p', width: 176, height: 144 },
    ],
    audioQualities: ['Best', '320 kbps', '256 kbps', '192 kbps', '128 kbps'],
    supports3gp: false,
    source: safeUrl,
  });
}

export function buildFallbackPlaylistResponse(url: string): string[] {
  const safeUrl = url || 'https://example.com/playlist';
  const titles = [
    'Playlist Video 1 — Sample',
    'Playlist Video 2 — Demo',
    'Playlist Video 3 — Example',
    'Playlist Video 4 — Test Clip',
    'Playlist Video 5 — Preview',
  ];
  return titles.map((title, idx) => JSON.stringify({
    id: `playlist-demo-${idx + 1}`,
    title,
    author: 'Playlist Author',
    duration: 120 + idx * 30,
    thumbnail: undefined,
    formats: [],
    available: true,
    videoFormats: ['MP4', 'WEBM'],
    audioFormats: ['MP3', 'M4A'],
    videoResolutions: [
      { label: '1080p', width: 1920, height: 1080 },
      { label: '720p', width: 1280, height: 720 },
      { label: '360p', width: 640, height: 360 },
      { label: '144p', width: 176, height: 144 },
    ],
    audioQualities: ['Best', '320 kbps', '192 kbps'],
    supports3gp: false,
    url: `${safeUrl}?v=${idx + 1}`,
    source: `${safeUrl}?v=${idx + 1}`,
  }));
}

const demoJobs = new Map<string, { start: number; outputPath: string }>();
const demoCancelled = new Set<string>();
const demoPaused = new Set<string>();

async function invokeTauri<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
  const tauriAvailable = "__TAURI_INTERNALS__" in globalThis;

  try {
    if (!tauriAvailable) {
      throw new Error('Tauri runtime is unavailable.');
    }

    const tauriCore = await import('@tauri-apps/api/core');
    const invoke = (tauriCore as { invoke?: <R>(name: string, args?: Record<string, unknown>) => Promise<R> }).invoke;

    if (typeof invoke !== 'function') {
      throw new Error('Tauri invoke is unavailable in this environment.');
    }

    return invoke<T>(command, payload);
  } catch (caughtError) {
    if (tauriAvailable) {
      throw caughtError;
    }

    if (command === 'get_app_info') {
      return {
        name: 'KWL Video Downloader',
        version: '0.1.0',
        platform: 'windows',
        environment: 'development',
      } as T;
    }

    if (command === 'validate_url') {
      const url = String((payload?.request as { url?: string } | undefined)?.url ?? '');
      return (Boolean(url) && /^https?:\/\//i.test(url)) as T;
    }

    if (command === 'analyze_url') {
      const url = String((payload?.request as { url?: string } | undefined)?.url ?? 'https://example.com/video');
      return buildFallbackAnalysisResponse(url) as T;
    }

    if (command === 'analyze_playlist') {
      const url = String((payload?.request as { url?: string } | undefined)?.url ?? 'https://example.com/playlist');
      return buildFallbackPlaylistResponse(url) as T;
    }

    if (command === 'start_download') {
      const request = (payload?.request as DownloadRequestPayload | undefined) ?? {
        url: 'https://example.com/video',
        media_type: 'video',
        container: 'mp4',
        quality: '1080p',
        output_directory: 'C:/Users/Downloads/KWL Video Downloader',
      };

      const id = `demo-job-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      demoJobs.set(id, { start: Date.now(), outputPath: request.output_directory });
      return {
        id,
        status: 'queued',
        output_path: request.output_directory,
        percent: 0,
        downloaded_bytes: 0,
        total_bytes: 50 * 1024 * 1024,
        speed_bytes_per_second: 0,
        eta_seconds: 30,
      } as T;
    }

    if (command === 'get_download_job') {
      const jobId = String(payload?.jobId ?? 'demo-job');
      if (demoCancelled.has(jobId)) {
        return {
          id: jobId,
          status: 'cancelled',
          output_path: null,
          percent: 0,
        } as T;
      }
      if (demoPaused.has(jobId)) {
        const job = demoJobs.get(jobId);
        return {
          id: jobId,
          status: 'paused',
          output_path: job?.outputPath ?? null,
          percent: 45,
        } as T;
      }
      const job = demoJobs.get(jobId);
      if (!job) {
        return {
          id: jobId,
          status: 'queued',
          output_path: null,
          percent: 0,
        } as T;
      }
      const elapsed = (Date.now() - job.start) / 1000;
      if (elapsed < 1) {
        return {
          id: jobId,
          status: 'queued',
          output_path: job.outputPath,
          percent: 0,
          downloaded_bytes: 0,
          total_bytes: 50 * 1024 * 1024,
          speed_bytes_per_second: 0,
          eta_seconds: 30,
        } as T;
      }
      if (elapsed < 6) {
        const progress = Math.min(95, Math.floor((elapsed / 6) * 100));
        return {
          id: jobId,
          status: 'downloading',
          output_path: job.outputPath,
          percent: progress,
          downloaded_bytes: Math.floor((progress / 100) * 50 * 1024 * 1024),
          total_bytes: 50 * 1024 * 1024,
          speed_bytes_per_second: 2.5 * 1024 * 1024,
          eta_seconds: Math.max(0, Math.floor(6 - elapsed)),
        } as T;
      }
      return {
        id: jobId,
        status: 'completed',
        output_path: `${job.outputPath}/demo-video.mp4`,
        filename: 'demo-video.mp4',
        percent: 100,
        downloaded_bytes: 50 * 1024 * 1024,
        total_bytes: 50 * 1024 * 1024,
        speed_bytes_per_second: 0,
        eta_seconds: 0,
      } as T;
    }

    if (command === 'cancel_download') {
      const jobId = String(payload?.jobId ?? 'demo-job');
      demoCancelled.add(jobId);
      demoJobs.delete(jobId);
      demoPaused.delete(jobId);
      return {
        id: jobId,
        status: 'cancelled',
        output_path: null,
      } as T;
    }

    if (command === 'pause_download') {
      const jobId = String(payload?.jobId ?? 'demo-job');
      demoPaused.add(jobId);
      return {
        id: jobId,
        status: 'paused',
        output_path: demoJobs.get(jobId)?.outputPath ?? null,
        percent: 45,
      } as T;
    }

    if (command === 'resume_download') {
      const jobId = String(payload?.jobId ?? 'demo-job');
      demoPaused.delete(jobId);
      const job = demoJobs.get(jobId);
      if (job) {
        // shift start so progress resumes from ~45%
        job.start = Date.now() - 2700;
      }
      return {
        id: jobId,
        status: 'downloading',
        output_path: job?.outputPath ?? null,
        percent: 45,
      } as T;
    }

    if (command === 'get_download_history') {
      return [] as T;
    }

    if (command === 'delete_download_history') {
      return [] as T;
    }

    if (command === 'delete_history_by_url') {
      return [] as T;
    }

    if (command === 'cleanup_broken_files') {
      return [] as T;
    }

    if (command === 'clear_download_history') {
      return [] as T;
    }

    if (command === 'open_media_file' || command === 'reveal_media_in_explorer') {
      throw new Error('Tauri runtime is unavailable.');
    }

    if (command === 'send_report') {
      return undefined as T;
    }

    throw new Error(`Unsupported command: ${command}`);
  }
}

export async function getAppInfo(): Promise<AppInfo> {
  return invokeTauri<AppInfo>('get_app_info');
}

export async function validateUrl(url: string): Promise<boolean> {
  return invokeTauri<boolean>('validate_url', { request: { url } });
}

export async function analyzeUrl(url: string): Promise<string> {
  return invokeTauri<string>('analyze_url', { request: { url } });
}

export async function analyzePlaylist(url: string): Promise<string[]> {
  return invokeTauri<string[]>('analyze_playlist', { request: { url } });
}

export async function startDownload(payload: DownloadRequestPayload): Promise<DownloadJobStatus> {
  return invokeTauri<DownloadJobStatus>('start_download', { request: payload });
}

export async function getDownloadJob(jobId: string): Promise<DownloadJobStatus> {
  return invokeTauri<DownloadJobStatus>('get_download_job', { jobId });
}

export async function cancelDownload(jobId: string): Promise<DownloadJobStatus> {
  return invokeTauri<DownloadJobStatus>('cancel_download', { jobId });
}

export async function pauseDownload(jobId: string): Promise<DownloadJobStatus> {
  return invokeTauri<DownloadJobStatus>('pause_download', { jobId });
}

export async function resumeDownload(jobId: string): Promise<DownloadJobStatus> {
  return invokeTauri<DownloadJobStatus>('resume_download', { jobId });
}

export async function getDownloadHistory(): Promise<DownloadHistoryEntry[]> {
  return invokeTauri<DownloadHistoryEntry[]>('get_download_history');
}

export async function deleteDownloadHistory(timestamp: string, outputPath?: string | null): Promise<DownloadHistoryEntry[]> {
  return invokeTauri<DownloadHistoryEntry[]>('delete_download_history', {
    request: { timestamp, output_path: outputPath ?? null },
  });
}

export async function deleteHistoryByUrl(url: string): Promise<DownloadHistoryEntry[]> {
  return invokeTauri<DownloadHistoryEntry[]>('delete_history_by_url', { url });
}

export async function cleanupBrokenFiles(outputDirectory?: string | null): Promise<string[]> {
  return invokeTauri<string[]>('cleanup_broken_files', { outputDirectory: outputDirectory ?? null });
}

export async function clearDownloadHistory(): Promise<DownloadHistoryEntry[]> {
  return invokeTauri<DownloadHistoryEntry[]>('clear_download_history', {});
}

export async function openMediaFile(path: string): Promise<void> {
  return invokeTauri<void>('open_media_file', { path });
}

export async function revealMediaInExplorer(path: string): Promise<void> {
  return invokeTauri<void>('reveal_media_in_explorer', { path });
}

export type ToolStatus = {
  name: string;
  version?: string | null;
  path?: string | null;
  status: string;
  health: string;
  last_check?: string | null;
};

export type AllToolsStatus = {
  tools: ToolStatus[];
  last_check?: string | null;
  update_available: boolean;
  active_download_protected: boolean;
};

export async function getToolsStatus(): Promise<AllToolsStatus> {
  return invokeTauri<AllToolsStatus>('get_tools_status');
}

export async function startupToolCheck(): Promise<AllToolsStatus> {
  return invokeTauri<AllToolsStatus>('startup_tool_check');
}

export async function getToolStatus(tool: string): Promise<ToolStatus> {
  return invokeTauri<ToolStatus>('get_tool_status', { tool });
}

export type ReportInput = {
  report_type: string;
  message: string;
  email?: string | null;
  logs?: string | null;
};

export async function sendReport(report: ReportInput): Promise<void> {
  return invokeTauri<void>('send_report', { report });
}
