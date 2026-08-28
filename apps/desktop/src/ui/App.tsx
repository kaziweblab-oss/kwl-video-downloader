import { useEffect, useMemo, useRef, useState } from 'react';
import { EntitlementService } from '@kwl/shared';
import { getAppShellState } from '../app';
import { analyzeUrl, analyzePlaylist, cancelDownload, clearDownloadHistory, deleteDownloadHistory, deleteHistoryByUrl, getAppInfo, getDownloadHistory, getDownloadJob, openMediaFile, pauseDownload, resumeDownload, revealMediaInExplorer, startDownload, startupToolCheck, validateUrl, type DownloadHistoryEntry, type DownloadJobStatus } from '../native/tauriBridge';
import { canAddToQueue, describeExistingDownload, findExistingDownload, formatOptionsFor, getSelectedFormatSize, getStepsForMedia, isAnalyzableUrl, nextWizardStep, parseDimension, prevWizardStep, qualityOptionsFor, qualityTiersWithDimensions, type FlowAnalysis, type FlowResolution, type WizardStepId } from './downloadFlow';
import { TranslationProvider, useLanguage } from './hooks/useTranslations';
import { DownloaderView, type DownloaderViewProps } from './components/DownloaderView';
import { QueueView } from './views/QueueView';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';
import { AboutView } from './views/AboutView';
import { useView, type View } from './store/viewStore';
import { SettingsProvider, useSettings } from './store/settingsStore';
import { Toast } from './components/Toast';

type MediaType = 'Video' | 'Audio';
type Language = 'en' | 'bn';

export type CartItemStatus = 'Pending' | 'Queued' | 'Downloading' | 'Paused' | 'Converting' | 'Processing' | 'Validating' | 'Completed' | 'Failed' | 'Cancelled';

const ACTIVE_CART_STATUSES: CartItemStatus[] = ['Queued', 'Downloading', 'Paused', 'Converting', 'Processing', 'Validating'];
const RUNNING_CART_STATUSES: CartItemStatus[] = ['Downloading', 'Converting', 'Processing', 'Validating'];

export type CartItem = {
  id: string;
  key: string;
  url: string;
  title: string;
  thumbnail?: string;
  mediaType: MediaType;
  format: string;
  quality: string;
  selectedDimension: FlowResolution | null;
  fps: number | null;
  transcode: boolean;
  durationSeconds?: number;
  status: CartItemStatus;
  jobId: string | null;
  percent: number;
  downloadedBytes?: number | null;
  totalBytes?: number | null;
  speed?: number | null;
  eta?: number | null;
  outputPath?: string | null;
  error?: string | null;
  // Pre-download size detection (from analysis)
  videoBytes?: number | null;
  audioBytes?: number | null;
  videoApprox?: number | null;
  audioApprox?: number | null;
  analyzedTotalBytes?: number | null;
  analyzedTotalApprox?: number | null;
  sizeKnown?: boolean;
  isApprox?: boolean;
};

const PROGRESS_RING_LENGTH = 2 * Math.PI * 16;

export function getCartItemStatus(jobStatus: string): CartItemStatus {
  const normalized = jobStatus.toLowerCase();
  if (normalized === 'completed') {
    return 'Completed';
  }
  if (normalized === 'cancelled') {
    return 'Cancelled';
  }
  if (normalized === 'paused') {
    return 'Paused';
  }
  if (normalized === 'converting') {
    return 'Converting';
  }
  if (normalized === 'processing') {
    return 'Processing';
  }
  if (normalized === 'validating') {
    return 'Validating';
  }
  if (normalized === 'downloading' || normalized === 'queued' || normalized === 'analyzing') {
    return normalized === 'downloading' ? 'Downloading' : 'Queued';
  }
  return 'Failed';
}

function applyJobToCartItem(item: CartItem, job: DownloadJobStatus): CartItem {
  const nextStatus = getCartItemStatus(job.status);
  // Monotonic overall progress: never move backward during single job (handles video+audio stream resets)
  const rawPercent = typeof job.percent === 'number' ? job.percent : null;
  const monotonicPercent = rawPercent != null ? Math.max(item.percent, rawPercent) : item.percent;
  // Phase floors: merging/converting 92, validating 98, completed 100 – never backward
  const phaseFloor = (() => {
    const s = nextStatus.toLowerCase();
    if (s === 'processing' || s === 'converting') return 92;
    if (s === 'validating') return 98;
    if (s === 'completed') return 100;
    return null;
  })();
  const finalPercent = phaseFloor != null ? Math.max(monotonicPercent, phaseFloor) : monotonicPercent;
  // Speed/ETA must be real or hidden – never retain stale fake values when backend reports none
  // Unknown total: keep bytes but allow indeterminate by totalBytes == null
  // FIX: use nullish coalescing so null does NOT overwrite known total (previous bug kept stale null)
  const nextTotal = job.total_bytes ?? item.totalBytes;
  // If backend omits speed/eta, hide them (null) rather than showing old -- placeholders
  const nextSpeed = job.speed_bytes_per_second !== undefined ? job.speed_bytes_per_second : null;
  const nextEta = job.eta_seconds !== undefined ? job.eta_seconds : null;
  // Preserve downloaded monotonic as well
  const monotonicDownloaded = (() => {
    const prev = item.downloadedBytes ?? 0;
    const next = job.downloaded_bytes ?? prev;
    return Math.max(prev, next);
  })();
  return {
    ...item,
    status: nextStatus,
    percent: finalPercent,
    downloadedBytes: monotonicDownloaded,
    totalBytes: nextTotal ?? null,
    speed: nextSpeed,
    eta: nextEta,
    outputPath: job.output_path ?? item.outputPath,
    error: nextStatus === 'Cancelled' ? null : job.error ?? item.error,
  };
}

function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('invoke') || message.includes('tauri') || message.includes('undefined')) {
      return 'The downloader is unavailable in this environment. Please try again or reopen the app.';
    }

    if (message.includes('invalid url') || message.includes('only http') || message.includes('url is required')) {
      return 'Please use a valid http or https link.';
    }

    if (message.includes('download failed') || message.includes('unable to')) {
      return 'The analysis could not complete. Please check the link and try again.';
    }

    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    const message = error.toLowerCase();
    if (message.includes('invoke') || message.includes('tauri')) {
      return 'The downloader is unavailable in this environment. Please try again or reopen the app.';
    }
    return error;
  }

  return fallback;
}

function AppContent() {
  const { view, setView } = useView();
  const { language, setLanguage } = useLanguage();
  const { settings } = useSettings();
  const shell = useMemo(() => getAppShellState(), []);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Ready');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<DownloadHistoryEntry[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [analyses, setAnalyses] = useState<FlowAnalysis[]>([]);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>('Video');
  const [mediaTypeChosen, setMediaTypeChosen] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [formatChosen, setFormatChosen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('');
  const [qualityChosen, setQualityChosen] = useState(false);
  const [selectedDimension, setSelectedDimension] = useState<FlowResolution | null>(null);
  const [outputDirectory, setOutputDirectory] = useState('C:\\Users\\Downloads\\KWL Video Downloader');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; duration?: number } | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStepId>('media');
  const [goToQueueDismissed, setGoToQueueDismissed] = useState(false);

  const isPlaylistUrl = (value: string) => {
    const lower = value.toLowerCase();
    return lower.includes('list=') || lower.includes('/playlist') || lower.includes('playlist?') || lower.includes('&list=');
  };

  const cartSequenceRef = useRef(0);
  const startingItemsRef = useRef<Set<string>>(new Set());
  const toastedJobsRef = useRef<Set<string>>(new Set());
  const [isQueuePaused, setIsQueuePaused] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success', duration?: number) => {
    setToast({ message, type, duration });
  };

  const activeMediaCount = selectedMediaIds.length;
  const mediaSelected = activeMediaCount > 0;
  const flowAnalysis: FlowAnalysis | null = mediaSelected ? (analyses.find((a) => a.id === activeMediaId) as FlowAnalysis) ?? null : null;
  const activeCartStatus = cart.find((item) => ACTIVE_CART_STATUSES.includes(item.status));
  const analyzeEnabled = isAnalyzableUrl(url) && !isLoading;
  const canAdd = canAddToQueue(
    { mediaType, format: selectedFormat, quality: selectedQuality, selectedDimension: mediaType === 'Video' ? selectedDimension : null },
    flowAnalysis,
  );
  const selectedSize = useMemo(() => getSelectedFormatSize(flowAnalysis, mediaType, selectedFormat, selectedQuality, mediaType === 'Video' ? selectedDimension : null), [flowAnalysis, mediaType, selectedFormat, selectedQuality, selectedDimension]);

  const wizardSteps = useMemo(() => getStepsForMedia(mediaType), [mediaType]);

  const resetDependentSelections = (level: 'media' | 'type' | 'format' | 'quality') => {
    if (level === 'media' || level === 'type') {
      setFormatChosen(false);
      setSelectedFormat('');
    }
    if (level === 'media' || level === 'type' || level === 'format') {
      setQualityChosen(false);
      setSelectedQuality('');
    }
    if (level === 'media' || level === 'type' || level === 'format' || level === 'quality') {
      setSelectedDimension(null);
    }
    // adjust wizard step downstream if needed (don't leave stale current step beyond available steps)
    // keep wizardStep valid for current media type
  };

  useEffect(() => {
    // Keep wizard step valid when media type switches (Audio skips resolution)
    if (!wizardSteps.includes(wizardStep)) {
      setWizardStep(wizardSteps[Math.max(0, wizardSteps.indexOf(wizardStep) - 1)] as WizardStepId ?? 'output');
    }
  }, [wizardSteps, wizardStep]);

  // Auto-select first media type/format/quality/dimension initially (user can change)
  useEffect(() => {
    if (!flowAnalysis || !mediaTypeChosen) return;
    if (formatChosen) return;
    const formats = formatOptionsFor(mediaType, flowAnalysis);
    if (formats.length > 0 && !formats.includes(selectedFormat)) {
      const first = formats[0]!;
      setSelectedFormat(first);
      setFormatChosen(true);
    }
  }, [flowAnalysis, mediaType, mediaTypeChosen, formatChosen, selectedFormat]);

  useEffect(() => {
    if (!flowAnalysis || !formatChosen) return;
    if (qualityChosen) return;
    if (mediaType === 'Video') {
      const tiers = qualityTiersWithDimensions(flowAnalysis);
      if (tiers.length > 0) {
        const first = tiers[0]!;
        setSelectedQuality(first.label);
        setQualityChosen(true);
        if (first.dimensions.length === 1) setSelectedDimension(first.dimensions[0]!);
        else setSelectedDimension(null);
      }
    } else {
      const quals = qualityOptionsFor(mediaType, flowAnalysis);
      if (quals.length > 0) {
        setSelectedQuality(quals[0]!);
        setQualityChosen(true);
      }
    }
  }, [flowAnalysis, mediaType, formatChosen, qualityChosen]);

  const canProceedCurrent = (() => {
    switch (wizardStep) {
      case 'media': return selectedMediaIds.length > 0;
      case 'type': return mediaTypeChosen;
      case 'format': return formatChosen;
      case 'quality': return qualityChosen;
      case 'output': return outputDirectory.trim().length > 0 && canAdd;
      default: return false;
    }
  })();

  const handleWizardNext = () => {
    if (!canProceedCurrent) return;
    const next = nextWizardStep(wizardStep, wizardSteps);
    if (next) setWizardStep(next);
  };
  const handleWizardBack = () => {
    const prev = prevWizardStep(wizardStep, wizardSteps);
    if (prev) setWizardStep(prev);
  };
  const handleStepClick = (step: WizardStepId) => {
    const curIdx = wizardSteps.indexOf(wizardStep);
    const targetIdx = wizardSteps.indexOf(step);
    // only completed steps clickable
    if (targetIdx < curIdx) setWizardStep(step);
  };

  const handleMediaCardSelect = (analysisId: string) => {
    const isSelected = selectedMediaIds.includes(analysisId);
    if (isSelected) {
      const next = selectedMediaIds.filter((id) => id !== analysisId);
      setSelectedMediaIds(next);
      if (activeMediaId === analysisId) {
        setActiveMediaId(next.length ? next[next.length - 1] : null);
      }
    } else {
      const next = [...selectedMediaIds, analysisId];
      setSelectedMediaIds(next);
      if (!activeMediaId) {
        setActiveMediaId(analysisId);
      } else {
        setActiveMediaId(analysisId);
      }
    }
  };

  const handleMediaTypePick = (option: MediaType) => {
    setMediaType(option);
    setMediaTypeChosen(true);
    resetDependentSelections('type');
    // Synchronous auto-select first format/quality so Add button enables immediately for Audio
    if (flowAnalysis) {
      const formats = formatOptionsFor(option, flowAnalysis);
      if (formats.length > 0) {
        const firstFormat = formats[0]!;
        setSelectedFormat(firstFormat);
        setFormatChosen(true);
        if (option === 'Video') {
          const tiers = qualityTiersWithDimensions(flowAnalysis);
          if (tiers.length > 0) {
            const first = tiers[0]!;
            setSelectedQuality(first.label);
            setQualityChosen(true);
            if (first.dimensions.length === 1) setSelectedDimension(first.dimensions[0]!);
            else setSelectedDimension(null);
          }
        } else {
          const quals = qualityOptionsFor(option, flowAnalysis);
          if (quals.length > 0) {
            setSelectedQuality(quals[0]!);
            setQualityChosen(true);
            setSelectedDimension(null);
          }
        }
      }
    }
  };

  const handleFormatPick = (format: string) => {
    setSelectedFormat(format);
    setFormatChosen(true);
    resetDependentSelections('format');
    // Synchronous auto-select first quality for immediate Add enable
    if (flowAnalysis) {
      if (mediaType === 'Video') {
        const tiers = qualityTiersWithDimensions(flowAnalysis);
        if (tiers.length > 0) {
          const first = tiers[0]!;
          setSelectedQuality(first.label);
          setQualityChosen(true);
          if (first.dimensions.length === 1) setSelectedDimension(first.dimensions[0]!);
          else setSelectedDimension(null);
        }
      } else {
        const quals = qualityOptionsFor(mediaType, flowAnalysis);
        if (quals.length > 0) {
          setSelectedQuality(quals[0]!);
          setQualityChosen(true);
        }
      }
    }
  };

  const handleQualityPick = (quality: string) => {
    setSelectedQuality(quality);
    setQualityChosen(true);
    resetDependentSelections('quality');
    // Auto-set dimension for single-dimension tiers (or audio)
    if (mediaType === 'Video' && flowAnalysis) {
      const tiers = qualityTiersWithDimensions(flowAnalysis);
      const selectedTier = tiers.find((t) => t.label === quality);
      if (selectedTier && selectedTier.dimensions.length === 1) {
        setSelectedDimension(selectedTier.dimensions[0]);
      }
    }
  };

  const handleDimensionPick = (dimension: FlowResolution) => {
    setSelectedDimension(dimension);
  };

  useEffect(() => {
    void getAppInfo()
      .then((info) => {
        setStatus(`${info.name} ${info.version}`);
      })
      .catch(() => {
        setStatus('Fallback environment');
      });
  }, []);

  useEffect(() => {
    void getDownloadHistory().then(setHistory).catch(() => setHistory([]));
  }, []);

  // Lightweight startup tool check (non-blocking, offline-safe) — B3/B4/B10
  useEffect(() => {
    void startupToolCheck()
      .then((status) => {
        const unhealthy = status.tools.filter((t) => t.health !== 'healthy' && t.health !== 'missing');
        if (unhealthy.length > 0) {
          showToast(`Tool check: ${unhealthy.map((t) => `${t.name} (${t.health})`).join(', ')} — using fallback if available`, 'error', 4000);
        }
        // Healthy tools: no intrusive dialog, subtle status only
      })
      .catch(() => {
        // Offline or check failed — keep current verified tools, app remains usable
      });
  }, []);

  // Default to user's Downloads/KWL Video Downloader (not Public) — respects requested Download section
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if ('__TAURI_INTERNALS__' in globalThis) {
          const { downloadDir } = await import('@tauri-apps/api/path');
          const dir = await downloadDir(); // e.g. C:\Users\Khairul Islam\Downloads\
          const kwl = `${dir.replace(/[\\/]+$/, '')}\\KWL Video Downloader`;
          if (!cancelled && kwl) setOutputDirectory(kwl);
        }
      } catch {
        // keep fallback
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refreshHistory = () => {
    void getDownloadHistory().then(setHistory).catch(() => setHistory([]));
  };

  const activeJobSignature = cart
    .filter((item) => item.jobId)
    .map((item) => `${item.id}:${item.jobId}`)
    .join('|');

  useEffect(() => {
    if (!activeJobSignature) {
      return undefined;
    }

    const trackedJobs = activeJobSignature
      .split('|')
      .map((pair) => pair.split(':'))
      .map(([itemId, jobId]) => ({ itemId, jobId }));

    const pollJobs = () => {
      trackedJobs.forEach(({ itemId, jobId }) => {
        void getDownloadJob(jobId)
          .then((job) => {
            // Temporary debug instrumentation (Part 2) — dev only, compact record
            // @ts-ignore - vite client types
            if ((import.meta as any).env?.DEV) {
              const frontendEntry = cart.find((c) => c.id === itemId);
              const frontendPct = frontendEntry?.percent ?? null;
              // eslint-disable-next-line no-console
              console.debug(`[PROGRESS] jobId=${jobId} status=${job.status} dl=${job.downloaded_bytes} tot=${job.total_bytes} pct=${job.percent} spd=${job.speed_bytes_per_second} eta=${job.eta_seconds} frontendPct=${frontendPct} phase=${job.status}`);
            }
            setCart((previous) => previous.map((entry) => (entry.id === itemId ? applyJobToCartItem(entry, job) : entry)));
            if (['completed', 'failed', 'cancelled'].includes(job.status)) {
              void getDownloadHistory().then(setHistory).catch(() => undefined);
            }
          })
          .catch((caughtError) => {
            setCart((previous) => previous.map((entry) => (
              entry.id === itemId
                ? { ...entry, status: 'Failed' as CartItemStatus, error: getFriendlyErrorMessage(caughtError, 'The download status could not be read.') }
                : entry
            )));
          });
      });
    };

    pollJobs();
    const timer = window.setInterval(pollJobs, 1000);
    return () => window.clearInterval(timer);
  }, [activeJobSignature]);

  // Auto-clear inline error/message after toast duration (prevent stuck window)
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 2500);
    return () => window.clearTimeout(t);
  }, [error]);

  // Queue complete: single message when full queue finishes (not per download)
  const prevActiveRef = useRef(false);
  useEffect(() => {
    const hasActive = cart.some((item) => ACTIVE_CART_STATUSES.includes(item.status));
    const hasItems = cart.length > 0;
    const allDone = hasItems && !hasActive && cart.every((item) => ['Completed', 'Failed', 'Cancelled'].includes(item.status));
    if (allDone && prevActiveRef.current) {
      const failed = cart.filter((i) => i.status === 'Failed').length;
      if (failed > 0 && failed === cart.length) {
        showToast('Queue download failed', 'error');
      } else if (failed > 0) {
        showToast(`Queue download complete — ${cart.length - failed} succeeded, ${failed} failed`, 'success');
      } else {
        showToast('Queue download complete', 'success');
      }
    }
    prevActiveRef.current = hasActive;
  }, [cart]);

  const handleAnalyze = async () => {
    setError(null);

    if (!isAnalyzableUrl(url)) {
      setError('Please enter a valid http/https URL.');
      setStatus('Validation failed');
      return;
    }

    const isBulk = isPlaylistUrl(url.trim());
    // Single mode duplicate check (bulk allows same playlist re-analyze)
    if (!isBulk && analyses.some((entry) => entry.sourceUrl === url.trim())) {
      const existing = analyses.find((entry) => entry.sourceUrl === url.trim());
      if (existing) {
        setSelectedMediaIds((prev) => (prev.includes(existing.id) ? prev : [...prev, existing.id]));
        setActiveMediaId(existing.id);
      }
      setStatus('Already analyzed — showing saved media');
      return;
    }

    setIsLoading(true);
    setStatus(isBulk ? 'Analyzing playlist…' : 'Analyzing…');

    try {
      const valid = await validateUrl(url);
      if (!valid) {
        setError('Please enter a valid http/https URL.');
        setStatus('Validation failed');
        return;
      }

      if (isBulk) {
        const rawList = await analyzePlaylist(url);
        const nextAnalyses = rawList.map((raw) => {
          try {
            const parsed = JSON.parse(raw) as { url?: string; source?: string };
            const src = parsed.url || parsed.source || url;
            return parseAnalysisResponse(raw, src);
          } catch {
            return parseAnalysisResponse(raw, url);
          }
        });
        const newIds = nextAnalyses.map((n) => n.id);
        // Count duplicates (common videos) for accurate feedback — previous logic (76 new of 100 etc.)
        const existingUrls = new Set(analyses.map((e) => e.sourceUrl));
        let newCount = 0;
        let dupCount = 0;
        for (const n of nextAnalyses) {
          if (existingUrls.has(n.sourceUrl)) dupCount++;
          else { newCount++; existingUrls.add(n.sourceUrl); }
        }
        setAnalyses((previous) => {
          let updated = [...previous];
          for (const next of nextAnalyses) {
            const idx = updated.findIndex((e) => e.sourceUrl === next.sourceUrl);
            if (idx >= 0) {
              updated[idx] = next;
            } else {
              updated.unshift(next);
            }
          }
          return updated;
        });
        setSelectedMediaIds((prev) => {
          const merged = [...prev];
          for (const id of newIds) if (!merged.includes(id)) merged.push(id);
          return merged;
        });
        if (newIds.length) setActiveMediaId(newIds[0]!);
        if (dupCount > 0) {
          const totalUnique = analyses.length + newCount;
          setStatus(`Playlist ready — ${nextAnalyses.length} items (${newCount} new, ${dupCount} common skipped) — total ${totalUnique} unique`);
          showToast(`Playlist: ${nextAnalyses.length} videos, ${newCount} new + ${dupCount} common skipped — total ${totalUnique} unique`, 'success');
        } else {
          setStatus(`Playlist ready — ${nextAnalyses.length} items added`);
          showToast(`Playlist analyzed: ${nextAnalyses.length} videos`, 'success');
        }
      } else {
        const rawAnalysis = await analyzeUrl(url);
        const parsedSingle = parseAnalysisResponse(rawAnalysis, url);
        const nextAnalysis = { ...parsedSingle, isPlaylist: false as const };
        setAnalyses((previous) => {
          const existingIndex = previous.findIndex((entry) => entry.sourceUrl === nextAnalysis.sourceUrl);
          if (existingIndex >= 0) {
            const copy = [...previous];
            copy[existingIndex] = nextAnalysis;
            return copy;
          }
          return [nextAnalysis, ...previous];
        });
        setSelectedMediaIds((prev) => (prev.includes(nextAnalysis.id) ? prev : [...prev, nextAnalysis.id]));
        setActiveMediaId(nextAnalysis.id);
        setStatus(nextAnalysis.available ? 'Media ready — select it from the list to configure' : 'Metadata unavailable');
      }
    } catch (caughtError) {
      const msg = getFriendlyErrorMessage(caughtError, 'The link could not be analyzed. Please check it and try again.');
      setError(msg);
      setStatus('Analysis failed');
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrowse = () => {
    setOutputDirectory((previous) => previous || 'C:\\Users\\Downloads\\KWL Video Downloader');
  };

  const createCartItem = (
    overrides: Partial<CartItem> & Pick<CartItem, 'url' | 'title' | 'mediaType' | 'format' | 'quality' | 'selectedDimension' | 'status'>,
  ): CartItem => {
    cartSequenceRef.current += 1;
    const dim = overrides.selectedDimension;
    const dimStr = dim ? `${dim.width}x${dim.height}` : '';
    return {
      id: `cart-${Date.now()}-${cartSequenceRef.current}`,
      key: `${overrides.url}|${overrides.mediaType}|${overrides.format}|${overrides.quality}|${dimStr}|${overrides.fps ?? ''}`,
      thumbnail: undefined,
      durationSeconds: undefined,
      jobId: null,
      percent: 0,
      downloadedBytes: null,
      totalBytes: null,
      speed: null,
      eta: null,
      outputPath: null,
      error: null,
      fps: null,
      transcode: false,
      ...overrides,
    };
  };

  const startCartItemJob = async (item: CartItem) => {
    try {
      const job = await startDownload({
        url: item.url,
        media_type: item.mediaType.toLowerCase(),
        container: item.format.toLowerCase(),
        quality: item.quality,
        output_directory: outputDirectory,
        resolution: item.mediaType === 'Video' && item.selectedDimension ? `${item.selectedDimension.width}x${item.selectedDimension.height}` : undefined,
        fps: item.mediaType === 'Video' && item.fps !== null ? item.fps : undefined,
        transcode: item.transcode || undefined,
        duration_seconds: item.durationSeconds,
        thumbnail: item.thumbnail,
        video_size_bytes: item.videoBytes ?? item.videoApprox ?? null,
        audio_size_bytes: item.audioBytes ?? item.audioApprox ?? null,
        total_size_bytes: item.analyzedTotalBytes ?? item.analyzedTotalApprox ?? item.totalBytes ?? null,
        size_known: item.sizeKnown ?? false,
      });
      setCart((previous) => previous.map((entry) => (entry.id === item.id ? {
        ...entry,
        jobId: job.id,
        status: getCartItemStatus(job.status),
        percent: job.percent ?? entry.percent,
        downloadedBytes: job.downloaded_bytes ?? entry.downloadedBytes ?? null,
        totalBytes: job.total_bytes ?? entry.totalBytes ?? entry.analyzedTotalBytes ?? entry.analyzedTotalApprox ?? null,
        speed: job.speed_bytes_per_second ?? null,
        eta: job.eta_seconds ?? null,
      } : entry)));
    } catch (caughtError) {
      const msg = getFriendlyErrorMessage(caughtError, 'Download request failed.');
      setCart((previous) => previous.map((entry) => (
        entry.id === item.id
          ? { ...entry, status: 'Failed' as CartItemStatus, error: msg }
          : entry
      )));
      showToast(`Download failed: ${msg}`, 'error');
    }
  };

  useEffect(() => {
    const maxConcurrent = settings.maxConcurrent ?? 2;
    // Pause All must freeze queue synchronously — use explicit flag plus fallback for individual Paused
    if (isQueuePaused) {
      return;
    }
    if (cart.some((item) => item.status === 'Paused')) {
      return;
    }
    const runningCount = cart.filter((item) => RUNNING_CART_STATUSES.includes(item.status) || (item.jobId !== null && item.status === 'Queued')).length;
    const availableSlots = maxConcurrent - runningCount - startingItemsRef.current.size;
    if (availableSlots <= 0) {
      return;
    }

    const queued = cart.filter((item) => item.status === 'Queued' && !item.jobId && !startingItemsRef.current.has(item.id)).slice(0, availableSlots);
    if (queued.length === 0) {
      return;
    }

    queued.forEach((next) => {
      startingItemsRef.current.add(next.id);
      void startCartItemJob(next).finally(() => {
        startingItemsRef.current.delete(next.id);
      });
    });
  }, [cart, settings.maxConcurrent, isQueuePaused]);

  // Auto-unfreeze if Pause All was used but no Paused items remain (removed/cancelled/completed) — prevents permanent freeze
  useEffect(() => {
    if (isQueuePaused && !cart.some((item) => item.status === 'Paused')) {
      setIsQueuePaused(false);
    }
  }, [cart, isQueuePaused]);

  const handleMarkAll = () => {
    if (analyses.length === 0) return;
    const allIds = analyses.map((a) => a.id);
    setSelectedMediaIds(allIds);
    // keep active as last selected (consistent with card toggle), or first if none
    setActiveMediaId((prev) => prev ?? allIds[0] ?? null);
    if (allIds[0]) setActiveMediaId(allIds[allIds.length - 1]!);
  };
  const handleUnmarkAll = () => {
    setSelectedMediaIds([]);
    // keep analyses, just clear selection
  };
  const handleClearAllAnalyses = () => {
    setAnalyses([]);
    setSelectedMediaIds([]);
    setActiveMediaId(null);
    resetDependentSelections('media');
    setWizardStep('media');
    showToast('Cleared all analyzed media', 'success');
  };

  const handleRemoveAnalysis = (analysisId: string) => {
    setAnalyses((previous) => previous.filter((entry) => entry.id !== analysisId));
    setSelectedMediaIds((previous) => previous.filter((id) => id !== analysisId));
    setActiveMediaId((previous) => (previous === analysisId ? null : previous));
    resetDependentSelections('media');
    if (analyses.length <= 1) setWizardStep('media');
  };

  const handleRemoveSelection = () => {
    if (selectedMediaIds.length === 0) return;
    // Delete marked cards from Analyzed Media (not just deselect) — fixes preview vs card confusion
    setAnalyses((previous) => previous.filter((entry) => !selectedMediaIds.includes(entry.id)));
    setSelectedMediaIds([]);
    setActiveMediaId(null);
    resetDependentSelections('media');
    setWizardStep('media');
    showToast(`Removed ${selectedMediaIds.length} selected item(s)`, 'success');
  };

  const handleAddToQueue = () => {
    setError(null);

    if (!canAdd) {
      let message: string;
      if (!mediaSelected) {
        message = 'Please select an analyzed video first.';
        setError(message);
        setStatus('Selection required');
      } else if (!mediaTypeChosen) {
        message = 'Please select Video or Audio.';
        setError(message);
        setStatus('Configuration incomplete');
      } else if (!formatChosen) {
        message = 'Please select a format.';
        setError(message);
        setStatus('Configuration incomplete');
      } else if (!qualityChosen) {
        message = 'Please select a quality.';
        setError(message);
        setStatus('Configuration incomplete');
      } else {
        message = 'Complete the required selections first.';
        setError(message);
        setStatus('Configuration incomplete');
      }
      showToast(message, 'error');
      return;
    }

    const targets = selectedMediaIds.length
      ? analyses.filter((entry) => selectedMediaIds.includes(entry.id))
      : [];

    if (targets.length === 0) {
      setError('Please select an analyzed video first.');
      setStatus('Selection required');
      return;
    }

    const itemDimension = mediaType === 'Video' ? selectedDimension : null;
    const addedItems: CartItem[] = [];
    let duplicateNotice: string | null = null;
    for (const entry of targets as Array<FlowAnalysis>) {
      if (!entry.available) {
        setError(`${entry.title}: media is unavailable.`);
        return;
      }

      // v1.0.0 is fully free: no license or entitlement checks are performed.

      const transcode = mediaType === 'Video' && selectedFormat === '3GP' && !entry.supports3gp;
      const existing = findExistingDownload(entry.sourceUrl, mediaType, selectedFormat, selectedQuality, itemDimension, cart, history);
      if (existing) {
        duplicateNotice = duplicateNotice ?? `${entry.title}: ${describeExistingDownload(existing)}.`;
        continue;
      }

      const size = getSelectedFormatSize(entry, mediaType, selectedFormat, selectedQuality, itemDimension);
      addedItems.push(createCartItem({
        url: entry.sourceUrl,
        title: entry.title,
        thumbnail: entry.thumbnail,
        durationSeconds: entry.durationSeconds,
        mediaType,
        format: selectedFormat,
        quality: selectedQuality,
        selectedDimension: itemDimension,
        transcode,
        status: 'Queued',
        key: `${entry.sourceUrl}|${mediaType}|${selectedFormat}|${selectedQuality}|${itemDimension ? `${itemDimension.width}x${itemDimension.height}` : ''}|`,
        videoBytes: size.videoSize,
        videoApprox: size.videoApprox,
        audioBytes: size.audioSize,
        audioApprox: size.audioApprox,
        analyzedTotalBytes: size.totalSize,
        analyzedTotalApprox: size.totalApprox,
        sizeKnown: size.sizeKnown,
        isApprox: size.isApprox,
        totalBytes: size.sizeKnown ? size.totalSize : (size.isApprox ? size.totalApprox : null),
        downloadedBytes: null,
        percent: 0,
      }));
    }

    if (addedItems.length === 0) {
      const msg = duplicateNotice ?? 'This item is already in the download queue.';
      setStatus(msg);
      // Already downloaded -> success style but longer hold (3800ms) with close btn, so user can read
      showToast(msg, 'success', 3800);
      return;
    }

    setCart((previous) => [...previous, ...addedItems]);
    const successMsg = duplicateNotice ? `Added ${addedItems.length} item(s) — ${duplicateNotice}` : `Added ${addedItems.length} video(s) to queue`;
    setStatus(duplicateNotice ? `Queued — ${duplicateNotice}` : 'Queued');
    showToast(successMsg, 'success', duplicateNotice ? 3000 : 1500);
    // Clear link input and analyzed media section after successful Add to Queue as requested
    setUrl('');
    setAnalyses([]);
    setSelectedMediaIds([]);
    setActiveMediaId(null);
    resetDependentSelections('media');
    setWizardStep('media');
    setGoToQueueDismissed(false);
  };

  const handleStartItem = (itemId: string) => {
    setError(null);
    setCart((previous) => previous.map((entry) => (
      entry.id === itemId
        ? { ...entry, status: 'Queued' as CartItemStatus, jobId: null, percent: 0, error: null }
        : entry
    )));
  };

  const handlePauseItem = (itemId: string) => {
    const item = cart.find((entry) => entry.id === itemId);
    if (!item?.jobId) {
      return;
    }

    void pauseDownload(item.jobId)
      .then((job) => {
        setCart((previous) => previous.map((entry) => (entry.id === itemId ? applyJobToCartItem(entry, job) : entry)));
      })
      .catch((caughtError) => {
        setError(getFriendlyErrorMessage(caughtError, 'The download could not be paused.'));
      });
  };

  const handleResumeItem = (itemId: string) => {
    const item = cart.find((entry) => entry.id === itemId);
    if (!item?.jobId) {
      return;
    }

    void resumeDownload(item.jobId)
      .then((job) => {
        setCart((previous) => previous.map((entry) => (entry.id === itemId ? applyJobToCartItem(entry, job) : entry)));
      })
      .catch((caughtError) => {
        setError(getFriendlyErrorMessage(caughtError, 'The download could not be resumed.'));
      });
  };

  const handleRemoveItem = (itemId: string) => {
    const item = cart.find((entry) => entry.id === itemId);
    if (item?.jobId && ACTIVE_CART_STATUSES.includes(item.status)) {
      void cancelDownload(item.jobId).catch(() => undefined);
    }
    if (item?.url) {
      void deleteHistoryByUrl(item.url).then(setHistory).catch(() => undefined);
    }
    setCart((previous) => previous.filter((entry) => entry.id !== itemId));
  };

  const handlePauseAll = () => {
    const toPause = cart.filter((item) => ['Downloading', 'Queued', 'Processing', 'Validating', 'Converting'].includes(item.status) && item.jobId);
    if (toPause.length === 0) {
      showToast('No active downloads to pause', 'error');
      return;
    }
    // Freeze queue synchronously before async native calls — prevents runner from starting next queued during pause window
    setIsQueuePaused(true);
    toPause.forEach((item) => {
      void pauseDownload(item.jobId!)
        .then((job) => setCart((prev) => prev.map((e) => (e.id === item.id ? applyJobToCartItem(e, job) : e))))
        .catch((e) => showToast(getFriendlyErrorMessage(e, 'Pause failed'), 'error'));
    });
    showToast(`Paused ${toPause.length} download(s)`, 'success');
  };

  const handleResumeAll = () => {
    const toResume = cart.filter((item) => item.status === 'Paused' && item.jobId);
    if (toResume.length === 0) {
      // Still clear flag if queue was paused but nothing to resume (e.g. all were queued without job)
      setIsQueuePaused(false);
      showToast('No paused downloads to resume', 'error');
      return;
    }
    setIsQueuePaused(false);
    toResume.forEach((item) => {
      void resumeDownload(item.jobId!)
        .then((job) => setCart((prev) => prev.map((e) => (e.id === item.id ? applyJobToCartItem(e, job) : e))))
        .catch((e) => showToast(getFriendlyErrorMessage(e, 'Resume failed'), 'error'));
    });
    showToast(`Resumed ${toResume.length} download(s)`, 'success');
  };

  const handleCancelAll = () => {
    const active = cart.filter((item) => ACTIVE_CART_STATUSES.includes(item.status) || ['Pending', 'Queued'].includes(item.status));
    if (active.length === 0) {
      showToast('No active downloads to cancel', 'error');
      return;
    }
    setIsQueuePaused(false);
    active.forEach((item) => {
      if (item.jobId) {
        void cancelDownload(item.jobId).catch(() => undefined);
      }
    });
    // Keep items as cancelled for history, don't remove immediately — let polling update status
    // For queued without jobId, mark cancelled directly
    setCart((prev) =>
      prev.map((e) => (active.some((a) => a.id === e.id && !e.jobId) ? { ...e, status: 'Cancelled' as CartItemStatus } : e))
    );
    showToast(`Cancelled ${active.length} item(s)`, 'success');
  };

  const handleClearQueue = () => {
    if (cart.length === 0) {
      showToast('Queue is already empty', 'error');
      return;
    }
    setIsQueuePaused(false);
    const active = cart.filter((item) => ACTIVE_CART_STATUSES.includes(item.status) || ['Pending', 'Queued'].includes(item.status));
    active.forEach((item) => {
      if (item.jobId) void cancelDownload(item.jobId).catch(() => undefined);
    });
    setCart([]);
    showToast(`Queue cleared — ${cart.length} item(s) removed`, 'success');
  };

  const handleOpenFile = async (path: string) => {
    try {
      await openMediaFile(path);
    } catch (caughtError) {
      setError(getFriendlyErrorMessage(caughtError, 'The media file could not be opened.'));
    }
  };

  const handleRevealFile = async (path: string) => {
    try {
      await revealMediaInExplorer(path);
    } catch (caughtError) {
      setError(getFriendlyErrorMessage(caughtError, 'The media folder could not be opened.'));
    }
  };

  const handleRetryHistory = (entry: DownloadHistoryEntry) => {
    if (!entry.url) {
      return;
    }

    const requestedMediaType: MediaType = entry.media_type.toLowerCase() === 'audio' ? 'Audio' : 'Video';
    const requestedFormat = entry.format.toUpperCase();
    const storedResolution = entry.resolution ?? '';
    const requestedQuality = requestedMediaType === 'Audio' ? (storedResolution || 'Best') : '720p';
    const requestedDimension = requestedMediaType === 'Video' ? parseDimension(storedResolution) : null;
    setUrl(entry.url);
    setMediaType(requestedMediaType);
    setSelectedFormat(requestedFormat);
    setSelectedQuality(requestedQuality);
    setSelectedDimension(requestedDimension);

    const retryItem = createCartItem({
      url: entry.url,
      title: entry.filename ?? entry.url,
      thumbnail: entry.thumbnail ?? undefined,
      mediaType: requestedMediaType,
      format: requestedFormat,
      quality: requestedQuality,
      selectedDimension: requestedDimension,
      fps: null,
      transcode: false,
      durationSeconds: undefined,
      status: 'Queued',
      key: `${entry.url}|${requestedMediaType}|${requestedFormat}|${requestedQuality}|${requestedDimension ? `${requestedDimension.width}x${requestedDimension.height}` : ''}|`,
    });
    setCart((previous) => [...previous, retryItem]);

    void deleteDownloadHistory(entry.timestamp, entry.output_path)
      .then((remaining) => setHistory(remaining))
      .catch((caughtError) => {
        setError(getFriendlyErrorMessage(caughtError, 'The failed history entry could not be removed.'));
      });
  };

  const handleDeleteHistoryEntry = (entry: DownloadHistoryEntry) => {
    void deleteDownloadHistory(entry.timestamp, entry.output_path)
      .then((remaining) => setHistory(remaining))
      .catch((caughtError) => {
        setError(getFriendlyErrorMessage(caughtError, 'The history entry could not be removed.'));
      });
  };

  const handleClearHistory = () => {
    if (history.length === 0) return;
    void clearDownloadHistory()
      .then((remaining) => {
        setHistory(remaining);
        showToast('History cleared — all entries removed', 'success');
      })
      .catch((caughtError) => {
        setError(getFriendlyErrorMessage(caughtError, 'History could not be cleared.'));
        showToast('Failed to clear history', 'error');
      });
  };

  const downloaderProps: DownloaderViewProps = {
    url,
    onUrlChange: setUrl,
    onPaste: () => navigator.clipboard?.readText?.().then((text) => setUrl(text || url)).catch(() => undefined),
    onAnalyze: handleAnalyze,
    onClear: () => setUrl(''),
    isLoading,
    status,
    error,
    analyses,
    selectedMediaIds,
    activeMediaId,
    onMediaCardSelect: handleMediaCardSelect,
    onRemoveAnalysis: handleRemoveAnalysis,
    onRemoveSelection: handleRemoveSelection,
    onMarkAll: handleMarkAll,
    onUnmarkAll: handleUnmarkAll,
    onClearAll: handleClearAllAnalyses,
    mediaType,
    mediaTypeChosen,
    selectedFormat,
    formatChosen,
    selectedQuality,
    qualityChosen,
    selectedDimension,
    onMediaTypePick: handleMediaTypePick,
    onFormatPick: handleFormatPick,
    onQualityPick: handleQualityPick,
    onDimensionPick: handleDimensionPick,
    outputDirectory,
    onOutputDirectoryChange: setOutputDirectory,
    onBrowse: handleBrowse,
    onAddToQueue: handleAddToQueue,
    canAdd,
    flowAnalysis,
    selectedSize,
    wizardStep,
    wizardSteps,
    onWizardNext: handleWizardNext,
    onWizardBack: handleWizardBack,
    onStepClick: handleStepClick,
    queueCount: cart.length,
    onGoToQueue: goToQueueDismissed ? undefined : () => { setGoToQueueDismissed(true); setView('queue'); },
  };

  const mainContent = (() => {
    if (view === 'downloader') return <DownloaderView {...downloaderProps} />;
    if (view === 'queue') {
      return (
        <QueueView
          cart={cart}
          onStartItem={handleStartItem}
          onPauseItem={handlePauseItem}
          onResumeItem={handleResumeItem}
          onRemoveItem={handleRemoveItem}
          onPauseAll={handlePauseAll}
          onResumeAll={handleResumeAll}
          onCancelAll={handleCancelAll}
          onClearQueue={handleClearQueue}
          onOpenFile={handleOpenFile}
          onRevealFile={handleRevealFile}
        />
      );
    }
    if (view === 'history') {
      return (
        <HistoryView
          history={history}
          onRetry={handleRetryHistory}
          onDelete={handleDeleteHistoryEntry}
          onClearAll={handleClearHistory}
          onOpenFile={handleOpenFile}
          onRevealFile={handleRevealFile}
          onRefresh={refreshHistory}
        />
      );
    }
    if (view === 'settings') return <SettingsView />;
    if (view === 'about') return <AboutView />;
    return <DownloaderView {...downloaderProps} />;
  })();

  return (
    <>
      {mainContent}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} duration={toast.duration ?? 1100} />}
    </>
  );
}

export function App() {
  return (
    <SettingsProvider>
      <TranslationProvider>
        <AppContent />
      </TranslationProvider>
    </SettingsProvider>
  );
}

function parseAnalysisResponse(raw: string | null | undefined, sourceUrl: string): FlowAnalysis {
  if (!raw) {
    return {
      id: `analysis-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      sourceUrl,
      title: 'Resolved media',
      author: 'Source media',
      duration: '5m 42s',
      durationSeconds: 342,
      formats: [],
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
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FlowAnalysis> & {
      url?: string;
      duration?: number | string;
      thumbnail?: string;
      formats?: Array<{
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
      }>;
      videoFormats?: string[];
      audioFormats?: string[];
      videoResolutions?: Array<{ label?: string; width?: number; height?: number }>;
      audioQualities?: string[];
      supports3gp?: boolean;
    };

    const formats = parsed.formats?.filter((format) => format.id && (format.hasVideo || format.hasAudio)) ?? [];
    const analyzedVideoContainers = [...new Set(formats.filter((format) => format.hasVideo).map((format) => format.container.toUpperCase()))];
    const analyzedAudioContainers = [...new Set(formats.filter((format) => format.hasAudio && !format.hasVideo).map((format) => format.container.toUpperCase()))];
    const videoFormats = [...new Set([...analyzedVideoContainers, 'MP4', 'WEBM', '3GP'])];
    const audioFormats = [...new Set([...['MP3', 'M4A', 'OPUS', 'WAV'], ...analyzedAudioContainers.filter((container) => !['WEBM', '3GP'].includes(container))])];
    let resolutions = [...new Map(
      formats
        .filter((format) => format.hasVideo && format.width && format.height)
        .map((format) => [`${format.width}x${format.height}`, { label: `${format.height}p`, width: format.width!, height: format.height! }])
    ).values()].sort((left, right) => right.height - left.height);
    if (parsed.videoResolutions?.length) {
      for (const entry of parsed.videoResolutions) {
        if (!entry.label || typeof entry.width !== 'number' || typeof entry.height !== 'number') continue;
        if (!resolutions.some((existing) => existing.width === entry.width && existing.height === entry.height)) {
          resolutions.push({ label: entry.label, width: entry.width, height: entry.height });
        }
      }
      resolutions.sort((left, right) => right.height - left.height || right.width - left.width);
    }
    if (resolutions.length === 0) {
      resolutions = [
        { label: '1080p', width: 1920, height: 1080 },
        { label: '720p', width: 1280, height: 720 },
        { label: '480p', width: 854, height: 480 },
        { label: '360p', width: 640, height: 360 },
        { label: '144p', width: 176, height: 144 },
      ];
    }
    if (!resolutions.some((entry) => entry.width === 176 && entry.height === 144)) {
      resolutions.push({ label: '144p', width: 176, height: 144 });
      resolutions.sort((left, right) => right.height - left.height || right.width - left.width);
    }
    const audioQualities = [...new Set(formats
      .filter((format) => format.hasAudio)
      .map((format) => format.bitrate ? `${Math.round(format.bitrate)} kbps` : 'Best'))];
    const durationSeconds = typeof parsed.duration === 'number' ? parsed.duration : Number(parsed.duration);
    const analysisUrl = parsed.url ?? sourceUrl;
    const analysisId = parsed.id ? `analysis-${parsed.id}` : `analysis-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    return {
      id: analysisId,
      sourceUrl: analysisUrl,
      title: parsed.title ?? 'Resolved media',
      author: parsed.author ?? 'Source media',
      duration: Number.isFinite(durationSeconds) ? `${Math.floor(durationSeconds / 60)}m ${Math.floor(durationSeconds % 60)}s` : '5m 42s',
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : undefined,
      thumbnail: parsed.thumbnail,
      formats,
      available: parsed.available ?? true,
      videoFormats,
      audioFormats: audioFormats.length ? audioFormats : ['MP3', 'M4A'],
      videoResolutions: resolutions,
      audioQualities: parsed.audioQualities?.length ? parsed.audioQualities : ['Best', '320 kbps', '256 kbps', '192 kbps', '128 kbps'],
      supports3gp: parsed.supports3gp ?? analyzedVideoContainers.includes('3GP'),
    };
  } catch {
    return {
      id: `analysis-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      sourceUrl,
      title: 'Resolved media',
      author: 'Source media',
      duration: '5m 42s',
      durationSeconds: 342,
      formats: [],
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
    };
  }
}
