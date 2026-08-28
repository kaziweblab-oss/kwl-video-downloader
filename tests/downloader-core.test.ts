import { describe, expect, it } from 'vitest';
import {
  RealDownloaderCore,
  isValidOutputDirectory,
  mapQualityToResolution,
  sanitizeFilename,
} from '../packages/downloader-core/src/index';

describe('downloader core', () => {
  it('validates a clean output directory', () => {
    expect(isValidOutputDirectory('C:/downloads')).toBe(true);
  });

  it('rejects traversal output directory', () => {
    expect(isValidOutputDirectory('../downloads')).toBe(false);
  });

  it('sanitizes a title into a safe filename', () => {
    expect(sanitizeFilename('My Video: final? [HD].mp4')).toBe('My Video final [HD].mp4');
  });

  it('maps quality to resolution', () => {
    expect(mapQualityToResolution('720p')).toBe('1280x720');
  });

  it('creates a valid download job', async () => {
    const core = new RealDownloaderCore();
    const job = await core.createDownload({
      url: 'https://example.com/video',
      mediaType: 'video',
      container: 'mp4',
      quality: '720p',
      outputDirectory: 'C:/downloads',
    });

    expect(job.status).toBe('queued');
    expect(job.id).toMatch(/^job-/);
  });

  it('cancels an existing job', async () => {
    const core = new RealDownloaderCore();
    const created = await core.createDownload({
      url: 'https://example.com/video',
      mediaType: 'audio',
      container: 'mp3',
      quality: 'medium',
      outputDirectory: 'C:/downloads',
    });

    const cancelled = await core.cancelDownload(created.id);
    expect(cancelled.status).toBe('cancelled');
  });
});
