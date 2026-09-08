export type FlowMedia = 'Video' | 'Audio';

export interface FlowResolution {
  label: string;
  width: number;
  height: number;
}

export interface QualityTier {
  label: string;
  height: number;
  dimensions: FlowResolution[];
}

export interface FlowAnalysis {
  id: string;
  sourceUrl: string;
  title: string;
  author: string;
  duration: string;
  durationSeconds?: number;
  thumbnail?: string;
  formats: Array<{
    id: string;
    mediaType: 'video' | 'audio';
    container: string;
    codec: string;
    width?: number;
    height?: number;
    fps?: number;
    bitrate?: number;
    hasVideo: boolean;
    hasAudio: boolean;
    requiresMerge: boolean;
    requiresProcessing: boolean;
    filesize?: number | null;
    filesizeApprox?: number | null;
  }>;
  available: boolean;
  videoFormats: string[];
  audioFormats: string[];
  videoResolutions: FlowResolution[];
  audioQualities: string[];
  supports3gp: boolean;
  isPlaylist?: boolean;
}

export type AnalysisState = FlowAnalysis;

export interface FlowSelection {
  mediaType: FlowMedia;
  format: string;
  quality: string;
  selectedDimension: FlowResolution | null;
}

export interface FlowCartItemLike {
  url: string;
  mediaType: string;
  format: string;
  quality: string;
  selectedDimension: FlowResolution | null;
  status: string;
}

export interface FlowHistoryLike {
  url?: string | null;
  media_type: string;
  format: string;
  resolution?: string | null;
  status: string;
  timestamp: string;
  output_path?: string | null;
  quality?: string;
  selectedDimension?: FlowResolution | null;
}

export type ExistingDownload =
  | { source: 'cart'; status: 'added' | 'queued' | 'downloading' | 'paused' }
  | { source: 'history'; status: 'downloaded' };

const BLOCKING_CART_STATUSES: Record<string, 'added' | 'queued' | 'downloading' | 'paused'> = {
  pending: 'added',
  queued: 'queued',
  downloading: 'downloading',
  processing: 'downloading',
  converting: 'downloading',
  validating: 'downloading',
  paused: 'paused',
};

export function isAnalyzableUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return false;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isResolutionVisible(mediaType: FlowMedia): boolean {
  return mediaType === 'Video';
}

export function formatOptionsFor(mediaType: FlowMedia, analysis: FlowAnalysis | null): string[] {
  if (!analysis) {
    return [];
  }
  return (mediaType === 'Video' ? analysis.videoFormats : analysis.audioFormats).slice();
}

export function qualityOptionsFor(mediaType: FlowMedia, analysis: FlowAnalysis | null): string[] {
  if (!analysis) {
    return [];
  }
  if (mediaType === 'Video') {
    const tiers = qualityTiersWithDimensions(analysis);
    return tiers.map((t) => t.label);
  }
  return analysis.audioQualities.slice();
}

export function qualityTiersWithDimensions(analysis: FlowAnalysis | null): QualityTier[] {
  if (!analysis) {
    return [];
  }
  const tierMap = new Map<string, FlowResolution[]>();
  for (const res of analysis.videoResolutions) {
    const existing = tierMap.get(res.label) ?? [];
    existing.push(res);
    tierMap.set(res.label, existing);
  }
  return [...tierMap.entries()]
    .map(([label, dimensions]) => ({
      label,
      height: dimensions[0]?.height ?? 0,
      dimensions: dimensions.sort((a, b) => b.width - a.width),
    }))
    .sort((a, b) => b.height - a.height);
}

export function resolutionOptionsFor(analysis: FlowAnalysis | null): FlowResolution[] {
  if (!analysis) {
    return [];
  }
  return analysis.videoResolutions.slice().sort((left, right) => right.height - left.height);
}

export interface QuickTier {
  label: string;
  height: number;
}

export function quickTiersFor(analysis: FlowAnalysis | null): QuickTier[] {
  if (!analysis) {
    return [];
  }
  const heightOf = (label: string): number => analysis.videoResolutions.find((resolution) => resolution.label === label)?.height ?? 0;
  return [...new Set(analysis.videoResolutions.map((resolution) => resolution.label))]
    .sort((left, right) => heightOf(right) - heightOf(left))
    .map((label) => ({ label, height: heightOf(label) }));
}

export function dimensionLabel(resolution: FlowResolution): string {
  return `${resolution.width}\u00d7${resolution.height}`;
}

export function resolutionHeight(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split(/[x\u00d7]/i);
  const candidate = parts.length === 2 ? parts[1] : (parts[0] ?? '');
  const height = Number.parseInt(candidate, 10);
  return Number.isFinite(height) && height > 0 ? height : null;
}

export function tierFromResolutionValue(value: string): string {
  const height = resolutionHeight(value);
  return height !== null ? `${height}p` : '';
}

export function parseDimension(value: string): FlowResolution | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/[x\u00d7]/i);
  if (parts.length !== 2) return null;
  const width = Number.parseInt(parts[0], 10);
  const height = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { label: `${width}x${height}`, width, height };
}

export function canAddToQueue(selection: FlowSelection, analysis: FlowAnalysis | null): boolean {
  if (!analysis || !analysis.available) {
    return false;
  }
  if (!selection.format || !selection.quality) {
    return false;
  }
  if (selection.mediaType === 'Video') {
    const tiers = qualityTiersWithDimensions(analysis);
    const selectedTier = tiers.find((t) => t.label === selection.quality);
    if (!selectedTier) return false;
    // If the quality tier has multiple dimensions, a dimension must be selected
    if (selectedTier.dimensions.length > 1 && !selection.selectedDimension) {
      return false;
    }
  }
  return true;
}

export function downloadKey(url: string, mediaType: FlowMedia, format: string, quality: string, dimension: FlowResolution | null): string {
  const dimStr = dimension ? `${dimension.width}x${dimension.height}` : '';
  return `${url}|${mediaType}|${format}|${quality}|${dimStr}`;
}

function sameVideoTarget(
  url: string,
  mediaType: FlowMedia,
  format: string,
  quality: string,
  dimension: FlowResolution | null,
  candidateUrl: string | null | undefined,
  candidateMediaType: string,
  candidateFormat: string,
  candidateQuality: string | null | undefined,
  candidateDimension: FlowResolution | null | undefined,
): boolean {
  if (candidateUrl !== url || candidateMediaType.toLowerCase() !== mediaType.toLowerCase()) {
    return false;
  }
  if (candidateFormat.toLowerCase() !== format.toLowerCase()) {
    return false;
  }
  if (candidateQuality !== quality) {
    return false;
  }
  if (mediaType === 'Video') {
    const requestedDim = dimension;
    const candidateDim = candidateDimension;
    if (requestedDim && candidateDim) {
      // Both have exact dimensions - must match exactly
      if (requestedDim.width !== candidateDim.width || requestedDim.height !== candidateDim.height) {
        return false;
      }
    } else if (requestedDim && !candidateDim) {
      // Requested has exact dimension, candidate only has tier - check if same tier (height)
      const requestedHeight = requestedDim.height;
      const candidateHeight = resolutionHeight(candidateQuality ?? '');
      if (candidateHeight !== null && requestedHeight !== candidateHeight) {
        return false;
      }
    } else if (!requestedDim && candidateDim) {
      // Candidate has exact dimension, requested only has tier - check if same tier (height)
      const requestedHeight = resolutionHeight(quality);
      const candidateHeight = candidateDim.height;
      if (requestedHeight !== null && requestedHeight !== candidateHeight) {
        return false;
      }
    }
    // If neither has exact dimension, they match by quality (already checked above)
  }
  return true;
}

export function findExistingDownload(
  url: string,
  mediaType: FlowMedia,
  format: string,
  quality: string,
  dimension: FlowResolution | null,
  cart: FlowCartItemLike[],
  history: FlowHistoryLike[],
): ExistingDownload | null {
  for (const item of cart) {
    if (!sameVideoTarget(url, mediaType, format, quality, dimension, item.url, item.mediaType, item.format, item.quality, item.selectedDimension)) {
      continue;
    }
    const status = BLOCKING_CART_STATUSES[item.status.toLowerCase()];
    if (status) {
      return { source: 'cart', status };
    }
  }

  for (const entry of history) {
    if (entry.status.toLowerCase() !== 'completed') {
      continue;
    }
    // Handle both old history format (resolution string) and new format (quality + selectedDimension)
    let entryQuality: string;
    let entryDimension: FlowResolution | null;
    if (mediaType === 'Audio') {
      // For audio, the quality was stored in resolution field
      entryQuality = entry.resolution ?? entry.quality ?? '';
      entryDimension = null;
    } else {
      entryQuality = entry.quality ?? tierFromResolutionValue(entry.resolution ?? '');
      entryDimension = entry.selectedDimension ?? parseDimension(entry.resolution ?? '');
    }
    if (sameVideoTarget(url, mediaType, format, quality, dimension, entry.url ?? undefined, entry.media_type, entry.format, entryQuality, entryDimension)) {
      return { source: 'history', status: 'downloaded' };
    }
  }

  return null;
}

export function describeExistingDownload(existing: ExistingDownload): string {
  if (existing.source === 'history') {
    return 'already downloaded (file exists in History)';
  }
  switch (existing.status) {
    case 'downloading':
      return 'currently downloading';
    case 'queued':
      return 'already queued';
    case 'paused':
      return 'already added (paused)';
    default:
      return 'already added to the queue';
  }
}

export type WizardStepId = 'media' | 'type' | 'format' | 'quality' | 'output';

export interface WizardState {
  selectedMediaIds: string[];
  mediaType: FlowMedia;
  mediaTypeChosen: boolean;
  formatChosen: boolean;
  format: string;
  qualityChosen: boolean;
  quality: string;
  selectedDimension: FlowResolution | null;
  outputDirectory: string;
}

export function getVideoWizardSteps(): WizardStepId[] { return ['media','type','format','quality','output']; }
export function getAudioWizardSteps(): WizardStepId[] { return ['media','type','format','quality','output']; }

export function getStepsForMedia(mediaType: FlowMedia): WizardStepId[] {
  return mediaType === 'Audio' ? getAudioWizardSteps() : getVideoWizardSteps();
}

export function isWizardStepCompleted(step: WizardStepId, state: WizardState): boolean {
  switch (step) {
    case 'media': return state.selectedMediaIds.length > 0;
    case 'type': return state.mediaTypeChosen;
    case 'format': return state.formatChosen;
    case 'quality': {
      if (!state.qualityChosen) return false;
      // For video, quality is complete when quality is chosen AND (single dimension or dimension selected)
      // This will be checked with actual analysis in canAddToQueue
      return true;
    }
    case 'output': return state.outputDirectory.trim().length > 0;
  }
}

export function canProceedFromStep(step: WizardStepId, state: WizardState): boolean {
  return isWizardStepCompleted(step, state);
}

export type StepStatus = 'completed' | 'current' | 'locked';

export function getWizardStepStatus(step: WizardStepId, current: WizardStepId, state: WizardState, steps: WizardStepId[]): StepStatus {
  const idx = steps.indexOf(step);
  const curIdx = steps.indexOf(current);
  if (idx < 0 || curIdx < 0) return 'locked';
  if (idx < curIdx) return 'completed';
  if (idx === curIdx) return 'current';
  // future
  // if all prior steps completed, the immediate next is still locked until current advances; but visually locked
  const priorCompleted = steps.slice(0, idx).every((s) => isWizardStepCompleted(s, state));
  if (!priorCompleted) return 'locked';
  return 'locked';
}

export function nextWizardStep(current: WizardStepId, steps: WizardStepId[]): WizardStepId | null {
  const idx = steps.indexOf(current);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return steps[idx + 1] ?? null;
}
export function prevWizardStep(current: WizardStepId, steps: WizardStepId[]): WizardStepId | null {
  const idx = steps.indexOf(current);
  if (idx <= 0) return null;
  return steps[idx - 1] ?? null;
}

// Pure progress aggregation helpers (mirrors Rust aggregator for frontend monotonic guard)
export interface ProgressFile {
  downloaded: number;
  total: number | null;
}
export function aggregateProgress(files: Map<string, ProgressFile>, peakPercent: number): { percent: number | null; downloaded: number; total: number | null } {
  let combinedDownloaded = 0;
  let combinedTotal: number | null = 0;
  let hasUnknown = false;
  for (const f of files.values()) {
    combinedDownloaded += f.downloaded;
    if (f.total == null) hasUnknown = true;
    else combinedTotal = (combinedTotal ?? 0) + f.total;
  }
  if (hasUnknown) combinedTotal = null;
  if (combinedTotal == null || combinedTotal === 0) return { percent: null, downloaded: combinedDownloaded, total: null };
  const raw = Math.min(100, (combinedDownloaded / combinedTotal) * 100);
  const monotonic = Math.max(peakPercent, raw);
  return { percent: monotonic, downloaded: combinedDownloaded, total: combinedTotal };
}

export const WIZARD_PHASE_FLOOR: Record<string, number> = { processing: 92, converting: 92, validating: 98, completed: 100 };
export function phaseFloor(status: string): number | null {
  const normalized = status.toLowerCase();
  if (normalized === 'processing' || normalized === 'merging') return 92;
  if (normalized === 'converting') return 92;
  if (normalized === 'validating') return 98;
  if (normalized === 'completed') return 100;
  return null;
}

export interface SelectedSize {
  videoSize: number | null;
  videoApprox: number | null;
  audioSize: number | null;
  audioApprox: number | null;
  totalSize: number | null;
  totalApprox: number | null;
  sizeKnown: boolean;
  isApprox: boolean;
}

function pickBestFormat(candidates: FlowAnalysis['formats']): FlowAnalysis['formats'][number] | null {
  if (candidates.length === 0) return null;
  // Prefer exact filesize, largest first
  const withExact = candidates.filter((f) => f.filesize != null);
  if (withExact.length > 0) {
    return withExact.sort((a, b) => (b.filesize ?? 0) - (a.filesize ?? 0))[0] ?? null;
  }
  const withApprox = candidates.filter((f) => f.filesizeApprox != null);
  if (withApprox.length > 0) {
    return withApprox.sort((a, b) => (b.filesizeApprox ?? 0) - (a.filesizeApprox ?? 0))[0] ?? null;
  }
  // Fallback largest bitrate
  return candidates.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0] ?? null;
}

export function getSelectedFormatSize(
  analysis: FlowAnalysis | null,
  mediaType: FlowMedia,
  format: string,
  quality: string,
  dimension: FlowResolution | null
): SelectedSize {
  const empty: SelectedSize = { videoSize: null, videoApprox: null, audioSize: null, audioApprox: null, totalSize: null, totalApprox: null, sizeKnown: false, isApprox: false };
  if (!analysis || !format || !quality) return empty;

  if (mediaType === 'Audio') {
    const audioCandidates = analysis.formats.filter((f) => f.hasAudio && !f.hasVideo);
    // Try match container if possible
    let filtered = audioCandidates.filter((f) => f.container.toLowerCase() === format.toLowerCase());
    if (filtered.length === 0) filtered = audioCandidates;
    const best = pickBestFormat(filtered);
    if (!best) return empty;
    const exact = best.filesize ?? null;
    const approx = best.filesizeApprox ?? null;
    const total = exact;
    const totalApprox = approx;
    return {
      videoSize: null,
      videoApprox: null,
      audioSize: exact,
      audioApprox: approx,
      totalSize: total,
      totalApprox: totalApprox,
      sizeKnown: total != null,
      isApprox: total == null && totalApprox != null,
    };
  }

  // Video: try find combined stream first (hasVideo && hasAudio) matching format/dimension
  const targetHeight = dimension?.height ?? resolutionHeight(quality) ?? null;
  const targetWidth = dimension?.width ?? null;

  let videoCandidates = analysis.formats.filter((f) => f.hasVideo && !f.hasAudio);
  // Filter by container if provided
  let byContainer = videoCandidates.filter((f) => f.container.toLowerCase() === format.toLowerCase());
  if (byContainer.length > 0) videoCandidates = byContainer;

  if (targetHeight != null) {
    const byHeight = videoCandidates.filter((f) => f.height === targetHeight);
    if (byHeight.length > 0) videoCandidates = byHeight;
    if (targetWidth != null) {
      const byWidth = videoCandidates.filter((f) => f.width === targetWidth);
      if (byWidth.length > 0) videoCandidates = byWidth;
    }
  }

  // Also consider combined streams as alternative (strict match for height/width)
  let combinedCandidates = analysis.formats.filter((f) => f.hasVideo && f.hasAudio);
  combinedCandidates = combinedCandidates.filter((f) => f.container.toLowerCase() === format.toLowerCase());
  if (targetHeight != null) {
    combinedCandidates = combinedCandidates.filter((f) => f.height === targetHeight);
    if (targetWidth != null) {
      combinedCandidates = combinedCandidates.filter((f) => f.width === targetWidth);
    }
  }

  const bestVideo = pickBestFormat(videoCandidates);
  const bestCombined = pickBestFormat(combinedCandidates);

  let videoSize: number | null = bestVideo?.filesize ?? null;
  let videoApprox: number | null = bestVideo?.filesizeApprox ?? null;
  let combinedSize: number | null = bestCombined?.filesize ?? null;
  let combinedApprox: number | null = bestCombined?.filesizeApprox ?? null;

  // If combined stream exists with size and matches selection, it is the total (muxed, no separate audio needed)
  if (combinedSize != null || combinedApprox != null) {
    return {
      videoSize: null,
      videoApprox: null,
      audioSize: null,
      audioApprox: null,
      totalSize: combinedSize,
      totalApprox: combinedApprox,
      sizeKnown: combinedSize != null,
      isApprox: combinedSize == null && combinedApprox != null,
    };
  }

  // Separate video + audio (most common for high quality)
  const audioCandidates = analysis.formats.filter((f) => f.hasAudio && !f.hasVideo);
  const bestAudio = pickBestFormat(audioCandidates);
  const audioSize = bestAudio?.filesize ?? null;
  const audioApprox = bestAudio?.filesizeApprox ?? null;
  // For exact total we need both exact; if one approx, total is approx
  let totalApprox: number | null = null;
  let isApprox = false;
  let sizeKnown = false;
  let finalTotal: number | null = null;

  if (videoSize != null && audioSize != null) {
    finalTotal = videoSize + audioSize;
    sizeKnown = true;
  } else if (videoSize != null && audioSize == null && audioApprox != null) {
    // video exact + audio approx => total approx
    totalApprox = videoSize + audioApprox;
    isApprox = true;
  } else if (videoSize == null && videoApprox != null && audioSize != null) {
    totalApprox = videoApprox + audioSize;
    isApprox = true;
  } else if (videoSize == null && videoApprox != null && audioSize == null && audioApprox != null) {
    totalApprox = videoApprox + audioApprox;
    isApprox = true;
  } else if (videoSize != null && audioSize == null && audioApprox == null) {
    // Only video exact, audio unknown
    finalTotal = null;
    totalApprox = videoApprox ?? null;
    if (totalApprox == null) {
      // unknown
    }
  } else if (videoSize == null && videoApprox != null) {
    totalApprox = videoApprox + (audioApprox ?? audioSize ?? 0);
    if (audioSize == null && audioApprox == null) {
      totalApprox = videoApprox;
    }
    isApprox = totalApprox != null;
  }

  // Fallback: if we have any exact total, use it
  if (finalTotal != null) {
    return { videoSize, videoApprox, audioSize, audioApprox, totalSize: finalTotal, totalApprox: null, sizeKnown: true, isApprox: false };
  }
  if (totalApprox != null) {
    return { videoSize, videoApprox, audioSize, audioApprox, totalSize: null, totalApprox, sizeKnown: false, isApprox: true };
  }
  // No sizes
  return { videoSize, videoApprox, audioSize, audioApprox, totalSize: null, totalApprox: null, sizeKnown: false, isApprox: false };
}

export function formatBytesForDisplay(bytes: number | null | undefined): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
