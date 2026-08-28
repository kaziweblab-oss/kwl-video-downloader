import { describe, expect, it } from 'vitest';
import {
  canAddToQueue,
  describeExistingDownload,
  downloadKey,
  findExistingDownload,
  formatOptionsFor,
  formatBytesForDisplay,
  getSelectedFormatSize,
  isAnalyzableUrl,
  isResolutionVisible,
  qualityOptionsFor,
  resolutionOptionsFor,
  resolutionHeight,
  tierFromResolutionValue,
  getStepsForMedia,
  getWizardStepStatus,
  nextWizardStep,
  prevWizardStep,
  aggregateProgress,
  phaseFloor,
  type FlowAnalysis,
} from '../apps/desktop/src/ui/downloadFlow';

const analysis: FlowAnalysis = {
  id: 'analysis-1',
  sourceUrl: 'https://example.com/video',
  available: true,
  videoFormats: ['MP4', 'WEBM', '3GP'],
  audioFormats: ['MP3', 'M4A'],
  videoResolutions: [
    { label: '1080p', width: 1920, height: 1080 },
    { label: '720p', width: 1280, height: 720 },
    { label: '576p', width: 1024, height: 576 },
  ],
  audioQualities: ['Best', '320 kbps', '128 kbps'],
  formats: [
    { id: 'f1', mediaType: 'video', container: 'mp4', width: 1920, height: 1080, fps: 30, hasVideo: true, hasAudio: false },
    { id: 'f2', mediaType: 'video', container: 'mp4', width: 1280, height: 720, fps: 30, hasVideo: true, hasAudio: false },
    { id: 'f3', mediaType: 'video', container: 'mp4', width: 1280, height: 720, fps: 60, hasVideo: true, hasAudio: false },
    { id: 'f4', mediaType: 'video', container: 'webm', width: 1024, height: 576, fps: 25, hasVideo: true, hasAudio: false },
    { id: 'a1', mediaType: 'audio', container: 'm4a', hasVideo: false, hasAudio: true },
  ],
};

const analysisWithoutFps: FlowAnalysis = {
  ...analysis,
  formats: analysis.formats.map((format) => ({ ...format, fps: undefined })),
};

const unavailableAnalysis: FlowAnalysis = { ...analysis, available: false };

describe('url gating', () => {
  it('accepts valid http/https urls', () => {
    expect(isAnalyzableUrl('https://example.com/video')).toBe(true);
    expect(isAnalyzableUrl('http://example.com/video')).toBe(true);
  });

  it('rejects invalid urls safely', () => {
    expect(isAnalyzableUrl('')).toBe(false);
    expect(isAnalyzableUrl('not a url')).toBe(false);
    expect(isAnalyzableUrl('javascript:alert(1)')).toBe(false);
    expect(isAnalyzableUrl('ftp://example.com/file')).toBe(false);
  });
});

describe('sequential flow gating', () => {
  it('hides resolution for audio and shows it for video', () => {
    expect(isResolutionVisible('Video')).toBe(true);
    expect(isResolutionVisible('Audio')).toBe(false);
  });

  it('exposes source-driven format options including always-available 3GP', () => {
    expect(formatOptionsFor('Video', analysis)).toEqual(['MP4', 'WEBM', '3GP']);
    expect(formatOptionsFor('Audio', analysis)).toEqual(['MP3', 'M4A']);
    expect(formatOptionsFor('Video', null)).toEqual([]);
  });

  it('exposes source-driven video quality tiers', () => {
    expect(qualityOptionsFor('Video', analysis)).toEqual(['1080p', '720p', '576p']);
    expect(qualityOptionsFor('Audio', analysis)).toEqual(['Best', '320 kbps', '128 kbps']);
    expect(qualityOptionsFor('Video', null)).toEqual([]);
  });

  it('lists exactly the source-provided resolutions without inventing any', () => {
    expect(resolutionOptionsFor(analysis).map((resolution) => resolution.label))
      .toEqual(['1080p', '720p', '576p']);
    expect(resolutionOptionsFor(analysis).map((resolution) => resolution.width)).toEqual([1920, 1280, 1024]);
    expect(resolutionOptionsFor(null)).toEqual([]);
  });

  it('parses heights from tier and exact resolution values', () => {
    expect(resolutionHeight('1080p')).toBe(1080);
    expect(resolutionHeight('1920\u00d71080')).toBe(1080);
    expect(resolutionHeight('1920x1080')).toBe(1080);
    expect(resolutionHeight('')).toBeNull();
    expect(tierFromResolutionValue('1920x1080')).toBe('1080p');
    expect(tierFromResolutionValue('1080p')).toBe('1080p');
  });

  it('keeps add disabled until every required selection is valid', () => {
    expect(canAddToQueue({ mediaType: 'Video', format: 'MP4', quality: 'Best', selectedDimension: null }, analysis)).toBe(false);
    expect(canAddToQueue({ mediaType: 'Video', format: '', quality: 'Best', selectedDimension: { label: '1920x1080', width: 1920, height: 1080 } }, analysis)).toBe(false);
    expect(canAddToQueue({ mediaType: 'Video', format: 'MP4', quality: '', selectedDimension: null }, analysis)).toBe(false);
    expect(canAddToQueue({ mediaType: 'Video', format: 'MP4', quality: 'Best', selectedDimension: { label: '1920x1080', width: 1920, height: 1080 } }, null)).toBe(false);
    expect(canAddToQueue({ mediaType: 'Video', format: 'MP4', quality: 'Best', selectedDimension: { label: '1920x1080', width: 1920, height: 1080 } }, unavailableAnalysis)).toBe(false);
  });

  it('enables the audio flow without resolution or fps', () => {
    expect(canAddToQueue({ mediaType: 'Audio', format: 'MP3', quality: '320 kbps', selectedDimension: null }, analysis)).toBe(true);
  });
});

describe('horizontal wizard', () => {
  it('returns VIDEO steps without resolution and AUDIO without', () => {
    expect(getStepsForMedia('Video')).toEqual(['media','type','format','quality','output']);
    expect(getStepsForMedia('Audio')).toEqual(['media','type','format','quality','output']);
  });
  it('next/prev navigation respects bounds', () => {
    const videoSteps = getStepsForMedia('Video');
    expect(nextWizardStep('media', videoSteps)).toBe('type');
    expect(nextWizardStep('output', videoSteps)).toBeNull();
    expect(prevWizardStep('media', videoSteps)).toBeNull();
    expect(prevWizardStep('quality', videoSteps)).toBe('format');
  });
  it('step status: completed/current/locked', () => {
    const videoSteps = getStepsForMedia('Video');
    const state = { selectedMediaIds: ['a1'], mediaType: 'Video' as const, mediaTypeChosen: true, formatChosen: false, format: '', qualityChosen: false, quality: '', selectedDimension: null, outputDirectory: '' };
    expect(getWizardStepStatus('media', 'type', state, videoSteps)).toBe('completed');
    expect(getWizardStepStatus('type', 'type', state, videoSteps)).toBe('current');
    expect(getWizardStepStatus('format', 'type', state, videoSteps)).toBe('locked');
  });
  it('future steps remain locked until prior steps complete', () => {
    const videoSteps = getStepsForMedia('Video');
    const emptyState = { selectedMediaIds: [], mediaType: 'Video' as const, mediaTypeChosen: false, formatChosen: false, format: '', qualityChosen: false, quality: '', selectedDimension: null, outputDirectory: '' };
    expect(getWizardStepStatus('format', 'media', emptyState, videoSteps)).toBe('locked');
    expect(getWizardStepStatus('quality', 'media', emptyState, videoSteps)).toBe('locked');
  });
  it('no FPS in wizard steps', () => {
    const all = [...getStepsForMedia('Video'), ...getStepsForMedia('Audio')];
    expect(all.join(',')).not.toMatch(/fps/i);
  });
});

describe('professional progress aggregation', () => {
  it('single-stream progress is monotonic (never backward)', () => {
    const files = new Map<string, { downloaded: number; total: number | null }>();
    files.set('video.mp4', { downloaded: 50, total: 100 });
    let res = aggregateProgress(files, 0);
    expect(res.percent).toBe(50);
    // simulate backward raw (30) but peak 50 should hold
    const files2 = new Map<string, { downloaded: number; total: number | null }>();
    files2.set('video.mp4', { downloaded: 30, total: 100 });
    res = aggregateProgress(files2, 50);
    expect(res.percent).toBe(50);
  });
  it('byte-weighted video+audio aggregation', () => {
    const files = new Map<string, { downloaded: number; total: number | null }>();
    files.set('video.mp4', { downloaded: 50, total: 100 });
    files.set('audio.m4a', { downloaded: 50, total: 100 });
    const res = aggregateProgress(files, 0);
    expect(res.downloaded).toBe(100);
    expect(res.total).toBe(200);
    expect(res.percent).toBe(50);
  });
  it('unknown total size does not fabricate percent', () => {
    const files = new Map<string, { downloaded: number; total: number | null }>();
    files.set('video.mp4', { downloaded: 824, total: null });
    const res = aggregateProgress(files, 0);
    expect(res.percent).toBeNull();
    expect(res.total).toBeNull();
  });
  it('phase floors do not move backward', () => {
    expect(phaseFloor('processing')).toBe(92);
    expect(phaseFloor('converting')).toBe(92);
    expect(phaseFloor('validating')).toBe(98);
    expect(phaseFloor('completed')).toBe(100);
    expect(phaseFloor('downloading')).toBeNull();
  });
  it('merge/convert/validating floors are monotonic', () => {
    const floors = [phaseFloor('processing'), phaseFloor('converting'), phaseFloor('validating'), phaseFloor('completed')];
    for (let i=1;i<floors.length;i++) expect((floors[i] ?? 0) >= (floors[i-1] ?? 0)).toBe(true);
  });
});

describe('file size detection', () => {
  const GB = 1024 * 1024 * 1024;
  const MB = 1024 * 1024;

  const sizedAnalysis: FlowAnalysis = {
    id: 'sized-1',
    sourceUrl: 'https://example.com/video',
    available: true,
    videoFormats: ['MP4', 'WEBM'],
    audioFormats: ['MP3'],
    videoResolutions: [
      { label: '1080p', width: 1920, height: 1080 },
      { label: '720p', width: 1280, height: 720 },
    ],
    audioQualities: ['Best'],
    formats: [
      { id: 'v1080', mediaType: 'video', container: 'mp4', width: 1920, height: 1080, hasVideo: true, hasAudio: false, filesize: 245000000, filesizeApprox: null, codec: 'avc1', requiresMerge: true, requiresProcessing: false },
      { id: 'v720', mediaType: 'video', container: 'mp4', width: 1280, height: 720, hasVideo: true, hasAudio: false, filesize: 120000000, filesizeApprox: null, codec: 'avc1', requiresMerge: true, requiresProcessing: false },
      { id: 'a1', mediaType: 'audio', container: 'm4a', hasVideo: false, hasAudio: true, filesize: 8400000, filesizeApprox: null, codec: 'mp4a', requiresMerge: false, requiresProcessing: false },
      { id: 'combined', mediaType: 'video', container: 'mp4', width: 640, height: 360, hasVideo: true, hasAudio: true, filesize: 50000000, filesizeApprox: null, codec: 'avc1', requiresMerge: false, requiresProcessing: false },
    ],
  };

  it('combines video + audio exact sizes', () => {
    const size = getSelectedFormatSize(sizedAnalysis, 'Video', 'MP4', '1080p', { label: '1920x1080', width: 1920, height: 1080 });
    expect(size.videoSize).toBe(245000000);
    expect(size.audioSize).toBe(8400000);
    expect(size.totalSize).toBe(253400000);
    expect(size.sizeKnown).toBe(true);
    expect(size.isApprox).toBe(false);
  });

  it('returns combined stream exact size', () => {
    // 360p combined stream has its own filesize, should be used when no separate video matches better
    const size = getSelectedFormatSize(sizedAnalysis, 'Video', 'MP4', '360p', { label: '640x360', width: 640, height: 360 });
    // For 360p we have combined entry, but our logic prefers combined when videoSize null, here we have 360p not in our sized list, fallback to combined 50MB? Actually 360p tier not in sized list, so it will fallback to best video? Let's test combined directly
    const combinedOnly: FlowAnalysis = {
      ...sizedAnalysis,
      formats: [{ id: 'c1', mediaType: 'video', container: 'mp4', width: 1920, height: 1080, hasVideo: true, hasAudio: true, filesize: 300000000, filesizeApprox: null, codec: 'avc1', requiresMerge: false, requiresProcessing: false }],
      videoResolutions: [{ label: '1080p', width: 1920, height: 1080 }],
    };
    const s2 = getSelectedFormatSize(combinedOnly, 'Video', 'MP4', '1080p', { label: '1920x1080', width: 1920, height: 1080 });
    expect(s2.totalSize).toBe(300000000);
    expect(s2.sizeKnown).toBe(true);
  });

  it('returns unknown when no filesize', () => {
    const unknown: FlowAnalysis = {
      ...sizedAnalysis,
      formats: sizedAnalysis.formats.map((f) => ({ ...f, filesize: null, filesizeApprox: null })),
    };
    const size = getSelectedFormatSize(unknown, 'Video', 'MP4', '1080p', { label: '1920x1080', width: 1920, height: 1080 });
    expect(size.totalSize).toBeNull();
    expect(size.sizeKnown).toBe(false);
  });

  it('uses filesize_approx with isApprox flag', () => {
    const approx: FlowAnalysis = {
      ...sizedAnalysis,
      formats: [
        { id: 'v1', mediaType: 'video', container: 'mp4', width: 1920, height: 1080, hasVideo: true, hasAudio: false, filesize: null, filesizeApprox: 250000000, codec: 'avc1', requiresMerge: true, requiresProcessing: false },
        { id: 'a1', mediaType: 'audio', container: 'm4a', hasVideo: false, hasAudio: true, filesize: null, filesizeApprox: 9000000, codec: 'mp4a', requiresMerge: false, requiresProcessing: false },
      ],
      videoResolutions: [{ label: '1080p', width: 1920, height: 1080 }],
    };
    const size = getSelectedFormatSize(approx, 'Video', 'MP4', '1080p', { label: '1920x1080', width: 1920, height: 1080 });
    expect(size.totalApprox).toBe(259000000);
    expect(size.isApprox).toBe(true);
    expect(size.sizeKnown).toBe(false);
  });

  it('handles 2GB+ values without overflow', () => {
    const large: FlowAnalysis = {
      ...sizedAnalysis,
      formats: [
        { id: 'v1', mediaType: 'video', container: 'mp4', width: 1920, height: 1080, hasVideo: true, hasAudio: false, filesize: 2 * GB, filesizeApprox: null, codec: 'avc1', requiresMerge: true, requiresProcessing: false },
        { id: 'a1', mediaType: 'audio', container: 'm4a', hasVideo: false, hasAudio: true, filesize: 100 * MB, filesizeApprox: null, codec: 'mp4a', requiresMerge: false, requiresProcessing: false },
      ],
      videoResolutions: [{ label: '1080p', width: 1920, height: 1080 }],
    };
    const size = getSelectedFormatSize(large, 'Video', 'MP4', '1080p', { label: '1920x1080', width: 1920, height: 1080 });
    expect(size.totalSize).toBe(2 * GB + 100 * MB);
    expect(formatBytesForDisplay(size.totalSize)).toBe('2.10 GB');
  });

  it('handles 5GB and 10GB', () => {
    expect(formatBytesForDisplay(5 * GB)).toBe('5.00 GB');
    expect(formatBytesForDisplay(10 * GB)).toBe('10.00 GB');
    const huge: FlowAnalysis = {
      ...sizedAnalysis,
      formats: [
        { id: 'v1', mediaType: 'video', container: 'mp4', width: 3840, height: 2160, hasVideo: true, hasAudio: false, filesize: 10 * GB, filesizeApprox: null, codec: 'avc1', requiresMerge: true, requiresProcessing: false },
        { id: 'a1', mediaType: 'audio', container: 'm4a', hasVideo: false, hasAudio: true, filesize: 500 * MB, filesizeApprox: null, codec: 'mp4a', requiresMerge: false, requiresProcessing: false },
      ],
      videoResolutions: [{ label: '2160p', width: 3840, height: 2160 }],
    };
    const size = getSelectedFormatSize(huge, 'Video', 'MP4', '2160p', { label: '3840x2160', width: 3840, height: 2160 });
    expect(size.totalSize).toBe(10 * GB + 500 * MB);
  });

  it('null handling for missing analysis', () => {
    const size = getSelectedFormatSize(null, 'Video', 'MP4', '1080p', null);
    expect(size.totalSize).toBeNull();
    expect(size.sizeKnown).toBe(false);
  });
});

describe('duplicate download guard', () => {
  const cart = [
    { url: 'https://example.com/video', mediaType: 'Video', format: 'MP4', quality: '1080p', selectedDimension: { label: '1920x1080', width: 1920, height: 1080 }, status: 'Downloading' },
  ];

  const history = [
    { url: 'https://example.com/other', media_type: 'video', format: 'mp4', resolution: '1080p', status: 'completed' },
    { url: 'https://example.com/video', media_type: 'video', format: 'mp4', resolution: '720p', status: 'failed' },
  ];

  it('blocks an active cart download with its status', () => {
    expect(findExistingDownload('https://example.com/video', 'Video', 'MP4', '1080p', { label: '1920x1080', width: 1920, height: 1080 }, cart, history))
      .toEqual({ source: 'cart', status: 'downloading' });
    expect(describeExistingDownload({ source: 'cart', status: 'downloading' })).toContain('downloading');
  });

  it('blocks paused, queued, and pending cart items', () => {
    const pausedCart = [{ ...cart[0], status: 'Paused' }];
    expect(findExistingDownload('https://example.com/video', 'Video', 'MP4', '1080p', { label: '1920x1080', width: 1920, height: 1080 }, pausedCart, []))
      .toEqual({ source: 'cart', status: 'paused' });

    const queuedCart = [{ ...cart[0], status: 'Queued' }];
    expect(findExistingDownload('https://example.com/video', 'Video', 'MP4', '1080p', { label: '1920x1080', width: 1920, height: 1080 }, queuedCart, []))
      .toEqual({ source: 'cart', status: 'queued' });

    const pendingCart = [{ ...cart[0], status: 'Pending' }];
    expect(findExistingDownload('https://example.com/video', 'Video', 'MP4', '1080p', { label: '1920x1080', width: 1920, height: 1080 }, pendingCart, []))
      .toEqual({ source: 'cart', status: 'added' });
  });

  it('blocks a completed history download whose file still exists', () => {
    const completedHistory = [
      { url: 'https://example.com/video', media_type: 'video', format: 'mp4', resolution: '1080p', status: 'completed' },
    ];
    expect(findExistingDownload('https://example.com/video', 'Video', 'MP4', '1080p', { label: '1920x1080', width: 1920, height: 1080 }, [], completedHistory))
      .toEqual({ source: 'history', status: 'downloaded' });
    expect(describeExistingDownload({ source: 'history', status: 'downloaded' })).toContain('downloaded');
  });

  it('matches legacy tier history entries with new dimension selections by height', () => {
    const legacyHistory = [
      { url: 'https://example.com/video', media_type: 'video', format: 'mp4', resolution: '1080p', status: 'completed' },
    ];
    expect(findExistingDownload('https://example.com/video', 'Video', 'MP4', '1080p', { label: '1920x1080', width: 1920, height: 1080 }, [], legacyHistory))
      .toEqual({ source: 'history', status: 'downloaded' });
    expect(findExistingDownload('https://example.com/video', 'Video', 'MP4', '1080p', { label: '1920x1080', width: 1920, height: 1080 }, [], legacyHistory))
      .toEqual({ source: 'history', status: 'downloaded' });
  });

  it('allows the same video when format or resolution tier changes', () => {
    expect(findExistingDownload('https://example.com/video', 'Video', 'WEBM', '1080p', { label: '1920x1080', width: 1920, height: 1080 }, cart, history)).toBeNull();
    expect(findExistingDownload('https://example.com/video', 'Video', 'MP4', '720p', { label: '1280x720', width: 1280, height: 720 }, cart, history)).toBeNull();
  });

  it('ignores completed cart items, failed history, and other videos', () => {
    const completedCart = [{ ...cart[0], status: 'Completed' }];
    expect(findExistingDownload('https://example.com/video', 'Video', 'MP4', '1080p', { label: '1920x1080', width: 1920, height: 1080 }, completedCart, [])).toBeNull();
    expect(findExistingDownload('https://example.com/third', 'Video', 'MP4', '1080p', { label: '1920x1080', width: 1920, height: 1080 }, [], history)).toBeNull();
  });

  it('matches audio duplicates by url and format regardless of quality', () => {
    const audioHistory = [
      { url: 'https://example.com/video', media_type: 'audio', format: 'mp3', resolution: '320 kbps', status: 'completed' },
    ];
    expect(findExistingDownload('https://example.com/video', 'Audio', 'MP3', '320 kbps', null, [], audioHistory))
      .toEqual({ source: 'history', status: 'downloaded' });
    expect(findExistingDownload('https://example.com/video', 'Audio', 'M4A', '320 kbps', null, [], audioHistory)).toBeNull();
  });
});