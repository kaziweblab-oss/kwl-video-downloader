import { describe, expect, it } from 'vitest';
import {
  EntitlementService,
  isValidHttpUrl,
  validateDownloadRequest,
  type DownloadRequest,
} from '../packages/shared/src/index';
import { buildFallbackAnalysisResponse } from '../apps/desktop/src/native/tauriBridge';

describe('shared domain validation', () => {
  it('accepts valid http URLs', () => {
    expect(isValidHttpUrl('https://example.com/video')).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(isValidHttpUrl('not-a-url')).toBe(false);
  });

  it('validates a valid request', () => {
    const request: DownloadRequest = {
      url: 'https://example.com/video',
      mediaType: 'video',
      container: 'mp4',
      quality: '720p',
      outputDirectory: 'C:/downloads',
    };

    expect(validateDownloadRequest(request)).toEqual([]);
  });

  it('rejects dangerous output directory values', () => {
    const request: DownloadRequest = {
      url: 'https://example.com/video',
      mediaType: 'video',
      container: 'mp4',
      quality: '720p',
      outputDirectory: '../temp',
    };

    expect(validateDownloadRequest(request)).toContain('INVALID_REQUEST');
  });

  it('requires a license for Free-plan audio over 20 minutes', () => {
    const result = new EntitlementService('FREE').canDownloadAudio(20 * 60 + 1);

    expect(result).toEqual({
      allowed: false,
      code: 'LICENSE_REQUIRED',
      message: 'Audio downloads longer than 20 minutes require a license.',
    });
  });

  it('allows long audio for a Pro plan', () => {
    expect(new EntitlementService('PRO').canDownloadAudio(60 * 60)).toEqual({ allowed: true });
  });

  it('keeps metadata available for valid video links when Tauri is unavailable', () => {
    const parsed = JSON.parse(buildFallbackAnalysisResponse('https://example.com/video'));

    expect(parsed.title).toContain('video');
    expect(parsed.available).toBe(true);
    expect(parsed.videoFormats).toContain('MP4');
  });
});
