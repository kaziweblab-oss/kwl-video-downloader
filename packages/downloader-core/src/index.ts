import {
  DownloadError,
  DownloadJob,
  DownloadRequest,
  DownloadResult,
  DownloadStatus,
  MediaFormat,
  VideoInfo,
  validateDownloadRequest,
  isValidHttpUrl,
} from '@kwl/shared';

export interface DownloaderCore {
  analyzeUrl(url: string): Promise<VideoInfo>;
  getFormats(url: string): Promise<VideoInfo['formats']>;
  createDownload(request: DownloadRequest): Promise<DownloadJob>;
  cancelDownload(jobId: string): Promise<DownloadJob>;
  getJob(jobId: string): Promise<DownloadJob | null>;
  listJobs(): Promise<DownloadJob[]>;
  cleanup(jobId: string): Promise<void>;
}

export type RuntimeResolutionError = 'RUNTIME_NOT_FOUND' | 'RUNTIME_INVALID' | 'INVALID_URL';

export class RealDownloaderCore implements DownloaderCore {
  private readonly jobs = new Map<string, DownloadJob>();

  async analyzeUrl(url: string): Promise<VideoInfo> {
    if (!isValidHttpUrl(url)) {
      throw this.createError('INVALID_URL', 'The provided URL is invalid.', false, 'url validation failed');
    }

    const fallbackFormats: MediaFormat[] = [
      { id: 'video-720p', mediaType: 'video', container: 'mp4', quality: '720p', resolution: '1280x720' },
      { id: 'video-480p', mediaType: 'video', container: 'mp4', quality: '480p', resolution: '854x480' },
      { id: 'audio-mp3', mediaType: 'audio', container: 'mp3', quality: 'medium' },
      { id: 'audio-m4a', mediaType: 'audio', container: 'm4a', quality: 'high' },
    ];

    return {
      id: 'analysis-demo',
      url,
      title: 'Resolved media',
      uploader: 'KWL Downloader',
      durationSeconds: 180,
      thumbnailUrl: 'https://example.com/thumbnail.jpg',
      formats: fallbackFormats,
      available: true,
    };
  }

  async getFormats(url: string): Promise<VideoInfo['formats']> {
    const result = await this.analyzeUrl(url);
    return result.formats;
  }

  async createDownload(request: DownloadRequest): Promise<DownloadJob> {
    const validationErrors = validateDownloadRequest(request);

    if (validationErrors.length > 0) {
      throw this.createError(
        'INVALID_REQUEST',
        'The request is invalid.',
        false,
        validationErrors.join(', ')
      );
    }

    const jobId = `job-${Date.now()}`;
    const job: DownloadJob = {
      id: jobId,
      request,
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: {
        jobId,
        status: 'queued',
        percent: 0,
        downloadedBytes: 0,
        totalBytes: 0,
      },
      error: null,
    };

    this.jobs.set(jobId, job);
    return job;
  }

  async cancelDownload(jobId: string): Promise<DownloadJob> {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw this.createError('CANCELLED', 'Job not found.', true, `job ${jobId} not found`);
    }

    job.status = 'cancelled';
    job.updatedAt = new Date().toISOString();
    job.progress.status = 'cancelled';
    job.progress.percent = 100;
    job.error = {
      code: 'CANCELLED',
      message: 'Download cancelled by user',
      recoverable: true,
    };

    return job;
  }

  async getJob(jobId: string): Promise<DownloadJob | null> {
    return this.jobs.get(jobId) ?? null;
  }

  async listJobs(): Promise<DownloadJob[]> {
    return Array.from(this.jobs.values());
  }

  async cleanup(jobId: string): Promise<void> {
    this.jobs.delete(jobId);
  }

  private createError(
    code: DownloadError['code'],
    message: string,
    recoverable: boolean,
    technicalDetails?: string
  ): DownloadError {
    return {
      code,
      message,
      recoverable,
      technicalDetails,
    };
  }
}

export function createDownloaderCore(): DownloaderCore {
  return new RealDownloaderCore();
}

export function toDownloadResult(job: DownloadJob): DownloadResult {
  return {
    job,
    success: job.status === 'completed',
  };
}

export function sanitizeFilename(value: string): string {
  return value
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export function isValidOutputDirectory(value: string): boolean {
  if (!value || value.trim().length === 0) {
    return false;
  }

  return !value.includes('..') && !value.includes('\0');
}

export function mapQualityToResolution(quality: string): string | undefined {
  const mapping: Record<string, string> = {
    '144p': '256x144',
    '240p': '426x240',
    '360p': '640x360',
    '480p': '854x480',
    '720p': '1280x720',
    '1080p': '1920x1080',
    '1440p': '2560x1440',
    '2160p': '3840x2160',
  };

  return mapping[quality] ?? undefined;
}
