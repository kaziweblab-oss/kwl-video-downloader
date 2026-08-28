export type PlatformName = 'windows' | 'linux' | 'macos';
export type MediaType = 'video' | 'audio';
export type ContainerFormat = 'mp4' | 'mkv' | 'webm' | '3gp' | 'mp3' | 'm4a' | 'wav';
export type VideoQuality = '144p' | '240p' | '360p' | '480p' | '720p' | '1080p' | '1440p' | '2160p';
export type AudioQuality = 'low' | 'medium' | 'high';
export type DownloadStatus = 'queued' | 'analyzing' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type Plan = 'FREE' | 'PRO' | 'ENTERPRISE';
export type EntitlementResult = { allowed: true } | { allowed: false; code: 'LICENSE_REQUIRED'; message: string };
export type DownloadErrorCode =
  | 'INVALID_URL'
  | 'INVALID_REQUEST'
  | 'RUNTIME_NOT_FOUND'
  | 'RUNTIME_INVALID'
  | 'FORMAT_UNAVAILABLE'
  | 'ANALYZE_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'PROCESSING_FAILED'
  | 'CANCELLED'
  | 'NETWORK_ERROR'
  | 'INTERNAL_ERROR';

export interface MediaFormat {
  id: string;
  mediaType: MediaType;
  container: ContainerFormat;
  quality: VideoQuality | AudioQuality;
  resolution?: string;
  bitrate?: number;
  codec?: string;
  width?: number;
  height?: number;
  fps?: number;
  filesize?: number;
  hasVideo?: boolean;
  hasAudio?: boolean;
  requiresMerge?: boolean;
  requiresProcessing?: boolean;
  isPremium?: boolean;
}

export interface VideoInfo {
  id: string;
  url: string;
  title: string;
  uploader?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  formats: MediaFormat[];
  available: boolean;
}

export interface DownloadRequest {
  url: string;
  mediaType: MediaType;
  container: ContainerFormat;
  quality: VideoQuality | AudioQuality;
  resolution?: string;
  outputDirectory: string;
  metadataOptions?: {
    includeMetadata?: boolean;
    sanitizeFilename?: boolean;
  };
}

export interface DownloadProgress {
  jobId: string;
  status: DownloadStatus;
  percent: number;
  downloadedBytes: number;
  totalBytes?: number;
  speedBytesPerSecond?: number;
  etaSeconds?: number;
}

export interface DownloadError {
  code: DownloadErrorCode;
  message: string;
  technicalDetails?: string;
  recoverable: boolean;
}

export interface DownloadJob {
  id: string;
  request: DownloadRequest;
  status: DownloadStatus;
  createdAt: string;
  updatedAt: string;
  progress: DownloadProgress;
  outputPath?: string;
  error?: DownloadError | null;
}

export interface DownloadResult {
  job: DownloadJob;
  success: boolean;
}

export type AppEnvironment = 'development' | 'staging' | 'production';

export interface AppVersionInfo {
  name: string;
  version: string;
  platform: PlatformName;
  environment: AppEnvironment;
}

export class EntitlementService {
  static readonly FREE_AUDIO_MAX_SECONDS = 20 * 60;

  constructor(private readonly plan: Plan = 'FREE') {}

  canDownloadAudio(durationSeconds?: number): EntitlementResult {
    if (this.plan !== 'FREE' || durationSeconds === undefined || durationSeconds <= EntitlementService.FREE_AUDIO_MAX_SECONDS) {
      return { allowed: true };
    }

    return {
      allowed: false,
      code: 'LICENSE_REQUIRED',
      message: 'Audio downloads longer than 20 minutes require a license.',
    };
  }
}

export function isValidHttpUrl(value: string): boolean {
  if (!value || value.trim().length === 0) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function sanitizeOutputDirectory(value: string): string {
  return value.replace(/\0/g, '').trim();
}

export function validateDownloadRequest(request: DownloadRequest): string[] {
  const errors: string[] = [];

  if (!isValidHttpUrl(request.url)) {
    errors.push('INVALID_URL');
  }

  if (!request.outputDirectory || sanitizeOutputDirectory(request.outputDirectory).length === 0) {
    errors.push('INVALID_REQUEST');
  }

  if (request.outputDirectory.includes('..')) {
    errors.push('INVALID_REQUEST');
  }

  if (!request.mediaType || !request.container || !request.quality) {
    errors.push('INVALID_REQUEST');
  }

  return errors;
}
