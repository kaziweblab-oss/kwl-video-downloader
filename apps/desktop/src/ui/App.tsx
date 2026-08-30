import { useEffect, useMemo, useRef, useState } from 'react';
import { EntitlementService } from '@kwl/shared';
import { getAppShellState } from '../app';
import { analyzeUrl, analyzePlaylist, cancelDownload, clearDownloadHistory, cleanupBrokenFiles, deleteDownloadHistory, deleteHistoryByUrl, getAppInfo, getDownloadHistory, getDownloadJob, openMediaFile, pauseDownload, resumeDownload, revealMediaInExplorer, startDownload, startupToolCheck, validateUrl, type DownloadHistoryEntry, type DownloadJobStatus } from '../native/tauriBridge';
import { canAddToQueue, describeExistingDownload, findExistingDownload, formatOptionsFor, getSelectedFormatSize, getStepsForMedia, isAnalyzableUrl, nextWizardStep, parseDimension, prevWizardStep, qualityOptionsFor, qualityTiersWithDimensions, type FlowAnalysis, type FlowResolution, type WizardStepId } from './downloadFlow';
import { useLanguage } from './hooks/useTranslations';
import { DownloaderView, type DownloaderViewProps } from './components/DownloaderView';
import { QueueView } from './views/QueueView';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';
import { AboutView } from './views/AboutView';
import { AdminVersionsView } from './versioning/AdminVersionsView';
import { VersionHistory } from './versioning/components/VersionHistory';
import { getVersions } from './versioning/tauriVersionsBridge';
import { useView, type View } from './store/viewStore';
import { useSettings } from './store/settingsStore';
import { Toast } from './components/Toast';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

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
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const lower = raw.toLowerCase();

  // Network / offline — highest priority
  if (lower.includes('network') || lower.includes('offline') || lower.includes('failed to fetch') || lower.includes('fetch failed') || lower.includes('internet') || lower.includes('econn') || lower.includes('timed out') || lower.includes('timeout') || lower.includes('dns') || lower.includes('enotfound') || lower.includes('err_internet_disconnected')) {
    if (lower.includes('timeout') || lower.includes('timed out')) return 'Request timed out — please check your internet connection and try again.';
    return 'No internet connection. Please check your network and try again.';
  }
  if (lower.includes('invoke') || lower.includes('tauri') || lower.includes('undefined')) {
    return 'The downloader is unavailable in this environment. Please try again or reopen the app.';
  }
  if (lower.includes('invalid url') || lower.includes('only http') || lower.includes('url is required')) {
    return 'Please enter a valid http or https link.';
  }
  if (lower.includes('unsupported url') || lower.includes('unsupported') || lower.includes('private') || lower.includes('unavailable') || lower.includes('no video') || lower.includes('video unavailable') || lower.includes('not available') || lower.includes('unable to retrieve') || lower.includes('unable to retrieve media details') || lower.includes('unable to retrieve playlist details')) {
    return 'This link is private, unsupported, or unavailable. Please try a public video link.';
  }
  if (lower.includes('invalid output directory') || lower.includes('unable to create output folder') || lower.includes('unable to create temporary download workspace')) {
    return 'Invalid output folder. Please pick a valid folder (e.g., Downloads/KWL Video Downloader) via Browse and try again.';
  }
  if (lower.includes('media file was not found') || lower.includes('media file is outside') || lower.includes('media file path is required') || lower.includes('downloaded output file was not found') || lower.includes('downloaded media failed validation') || lower.includes('downloaded media has no valid')) {
    return 'Media file not found, outside allowed folders, or failed validation. Please check the path and try again.';
  }
  if (lower.includes('resolution is required') || lower.includes('quality is required') || lower.includes('format is required') || lower.includes('fps must be greater')) {
    return 'Please complete the required selections (Type, Format, Quality/Dimension) before adding to queue.';
  }
  if (lower.includes('yt-dlp') || lower.includes('runtime is not available') || lower.includes('ffprobe runtime is not available') || lower.includes('ffmpeg runtime is not available')) {
    return 'Downloader engine not ready. Please restart the app and try again.';
  }
  if (lower.includes('download failed') || lower.includes('unable to')) {
    return 'The analysis could not complete. Please check the link and try again.';
  }

  if (raw && raw.trim()) return raw.trim();
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
  const [defaultOutputFolder, setDefaultOutputFolder] = useState('C:\\Users\\Downloads\\KWL Video Downloader');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; duration?: number } | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStepId>('media');
  const [goToQueueDismissed, setGoToQueueDismissed] = useState(false);
  const [lastAnalyzeResult, setLastAnalyzeResult] = useState<null | { kind: 'single' | 'playlist'; count: number; label: string }>(null);
  const [updateAvailable, setUpdateAvailable] = useState<{ version: string; update: Awaited<ReturnType<typeof check>> } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const isPlaylistUrl = (value: string) => {
    const lower = value.toLowerCase();
    return lower.includes('list=') || lower.includes('/playlist') || lower.includes('playlist?') || lower.includes('&list=');
  };

  const cartSequenceRef = useRef(0);
  const startingItemsRef = useRef<Set<string>>(new Set());
  const toastedJobsRef = useRef<Set<string>>(new Set());
  const cartRef = useRef<CartItem[]>([]);
  useEffect(() => { cartRef.current = cart; }, [cart]);
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

  // Cleanup orphaned PART files left from previous failed/cancelled downloads (fixes Today duplicate PARTs)
  useEffect(() => {
    void cleanupBrokenFiles(outputDirectory || undefined).catch(() => {});
    const id = window.setInterval(() => {
      void cleanupBrokenFiles(outputDirectory || undefined).catch(() => {});
    }, 60_000);
    const onFocus = () => { void cleanupBrokenFiles(outputDirectory || undefined).catch(() => {}); };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [outputDirectory]);

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

  // Auto-update check on app start — MANUAL ONLY: notify with Update/Cancel buttons, no auto-download or auto-close
  // Offline-safe: do not fetch when no internet — app must open offline without ERR_INTERNET_DISCONNECTED
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          console.debug('Offline — skip update check');
          return;
        }
        if (!('__TAURI_INTERNALS__' in globalThis)) return;
        if (!settings.autoUpdate) return;
        const update = await check();
        if (update) {
          const v = (update as any).version ?? 'newer';
          window.dispatchEvent(new CustomEvent('kwl:update-available', { detail: { version: v } }));
          try { localStorage.setItem('kwl:update-available', JSON.stringify({ version: v, at: Date.now() })); } catch {}
          // Show persistent notification with Update/Cancel — never auto-close window
          setUpdateAvailable({ version: v, update });
          try {
            if ('Notification' in window) {
              if (Notification.permission === 'granted') {
                new Notification('KWL Video Downloader', { body: language === 'bn' ? `v${v} আপডেট এসেছে` : `v${v} available — open Settings → Updates` });
              } else if (Notification.permission !== 'denied') {
                void Notification.requestPermission().then((p) => { if (p === 'granted') new Notification('KWL Video Downloader', { body: `v${v} available` }); });
              }
            }
          } catch {}
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const lower = msg.toLowerCase();
        // Valid json / parse / html means endpoint returned 404 HTML instead of json — treat as no update, not error
        if (lower.includes('404') || lower.includes('not found') || lower.includes('failed to fetch') || lower.includes('network') || lower.includes('offline') || lower.includes('valid json') || lower.includes('json') && lower.includes('parse') || lower.includes('unexpected token') || lower.includes('html')) {
          console.debug('Update check: no release / offline / invalid json (treat as up-to-date)', msg);
        } else if (lower.includes('signature')) {
          console.debug('Update signature verify failed (await release):', msg);
        } else if (msg) {
          console.debug('Update check failed:', msg);
        }
      }
    };
    const timer = setTimeout(checkUpdate, 3000);
    // Universal periodic check every 4 hours for all platforms (Windows, Linux, macOS, Android)
    const interval = setInterval(checkUpdate, 4 * 60 * 60 * 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [settings.autoUpdate, language]);

  // Default to user's Downloads/KWL Video Downloader (not Public) — respects requested Download section
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if ('__TAURI_INTERNALS__' in globalThis) {
          const { downloadDir } = await import('@tauri-apps/api/path');
          const dir = await downloadDir(); // e.g. C:\Users\Khairul Islam\Downloads\
          const kwl = `${dir.replace(/[\\/]+$/, '')}\\KWL Video Downloader`;
          if (!cancelled && kwl) {
            setDefaultOutputFolder(kwl);
            // Only set outputDirectory to default if still at fallback (not yet customized)
            setOutputDirectory((prev) => (prev === 'C:\\Users\\Downloads\\KWL Video Downloader' ? kwl : prev));
          }
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

  // Pull-to-refresh / scroll-to-bottom refresh — triggered by AppShell (nicher dike scroll + pull-down)
  useEffect(() => {
    const handler = () => {
      refreshHistory();
      void getAppInfo().then((info) => setStatus(`${info.name} ${info.version}`)).catch(() => undefined);
      showToast('Refreshed', 'success', 1200);
      // notify shell that soft refresh completed so spinner can stop early
      window.dispatchEvent(new CustomEvent('kwl:refresh-complete'));
    };
    window.addEventListener('kwl:refresh', handler as EventListener);
    return () => window.removeEventListener('kwl:refresh', handler as EventListener);
  }, []);

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
    // Single mode duplicate check (bulk allows same playlist re-analyze) — local, works offline
    if (!isBulk && analyses.some((entry) => entry.sourceUrl === url.trim())) {
      const existing = analyses.find((entry) => entry.sourceUrl === url.trim());
      if (existing) {
        setSelectedMediaIds((prev) => (prev.includes(existing.id) ? prev : [...prev, existing.id]));
        setActiveMediaId(existing.id);
        setLastAnalyzeResult({ kind: 'single', count: 1, label: existing.title });
      }
      setStatus('Already analyzed — showing saved media');
      showToast(language === 'bn' ? 'ইতিমধ্যে বিশ্লেষণ করা — সংরক্ষিত মিডিয়া দেখানো হচ্ছে' : 'Already analyzed — showing saved media', 'success');
      return;
    }

    // Offline guard — network required for new analysis; DevTools Offline and Tauri offline both block here
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const msg = language === 'bn'
        ? 'ইন্টারনেট সংযোগ নেই। অনুগ্রহ করে নেটওয়ার্ক চেক করে আবার চেষ্টা করুন।'
        : 'No internet connection. Please check your network and try again.';
      setError(msg);
      setStatus('Offline');
      showToast(msg, 'error');
      return;
    }

    setIsLoading(true);
    setError(null);
    setLastAnalyzeResult(null);
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
        // Playlist analyze always REPLACES previous list (single→playlist and playlist→playlist clear, per spec)
        // Deduplicate within the new playlist itself only
        const dedupedByUrl = new Map<string, typeof nextAnalyses[0]>();
        for (const n of nextAnalyses) {
          if (!dedupedByUrl.has(n.sourceUrl)) dedupedByUrl.set(n.sourceUrl, n);
        }
        const uniqueNext = Array.from(dedupedByUrl.values());
        const finalIds = uniqueNext.map((n) => n.id);
        setAnalyses(uniqueNext);
        setSelectedMediaIds(finalIds);
        if (finalIds.length) setActiveMediaId(finalIds[0]!);
        else setActiveMediaId(null);
        if (uniqueNext.length < nextAnalyses.length) {
          const dup = nextAnalyses.length - uniqueNext.length;
          setStatus(`Playlist ready — ${uniqueNext.length} videos (${dup} duplicates removed)`);
          setLastAnalyzeResult({ kind: 'playlist', count: uniqueNext.length, label: `${dup} duplicates removed` });
          showToast(`Playlist: ${uniqueNext.length} videos (${dup} duplicates removed)`, 'success');
        } else {
          setStatus(`Playlist ready — ${uniqueNext.length} videos`);
          setLastAnalyzeResult({ kind: 'playlist', count: uniqueNext.length, label: '' });
          showToast(`Playlist analyzed: ${uniqueNext.length} videos`, 'success');
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
        setLastAnalyzeResult({ kind: 'single', count: 1, label: nextAnalysis.title });
        setStatus(nextAnalysis.available ? 'Media ready — select it from the list to configure' : 'Metadata unavailable');
      }
    } catch (caughtError) {
      const msg = getFriendlyErrorMessage(caughtError, 'The link could not be analyzed. Please check it and try again.');
      setError(msg);
      setLastAnalyzeResult(null);
      setStatus('Analysis failed');
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrowse = async () => {
    try {
      if ('__TAURI_INTERNALS__' in globalThis) {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          directory: true,
          multiple: false,
          defaultPath: outputDirectory || undefined,
          title: 'Select output folder',
        }) as string | string[] | null;
        const picked = Array.isArray(selected) ? selected[0] ?? null : selected;
        if (picked && typeof picked === 'string') {
          // Normalize: remove surrounding quotes, keep as OS path (single backslashes)
          setOutputDirectory(picked.replace(/^\"+|\"+$/g, ''));
          showToast('Output folder updated', 'success', 1500);
        }
      } else {
        // Browser preview fallback
        setOutputDirectory((previous) => previous || 'C:\\Users\\Downloads\\KWL Video Downloader');
        showToast('File picker only available in desktop app', 'error');
      }
    } catch (caughtError) {
      setError(getFriendlyErrorMessage(caughtError, 'Could not open folder picker.'));
    }
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
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const msg = language === 'bn'
        ? 'ইন্টারনেট নেই — ডাউনলোড শুরু করতে নেটওয়ার্ক লাগবে।'
        : 'Offline — download needs internet. Please connect and try again.';
      setCart((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, status: 'Failed' as CartItemStatus, error: msg } : entry));
      showToast(msg, 'error');
      return;
    }
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
    // Pause All freezes queue — individual Paused items do NOT block next queued downloads
    if (isQueuePaused) {
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
    setLastAnalyzeResult(null);
    setError(null);
    resetDependentSelections('media');
    setWizardStep('media');
    showToast('Cleared all analyzed media', 'success');
  };

  const handleRemoveAnalysis = (analysisId: string) => {
    setAnalyses((previous) => {
      const next = previous.filter((entry) => entry.id !== analysisId);
      if (next.length === 0) { setLastAnalyzeResult(null); setError(null); }
      return next;
    });
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
    setLastAnalyzeResult(null);
    setError(null);
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
    const mediaLabel = mediaType === 'Audio' ? (language === 'bn' ? 'অডিও' : 'audio') : (language === 'bn' ? 'ভিডিও' : 'video');
    const countLabel = addedItems.length === 1 ? `${addedItems.length} ${mediaLabel}` : `${addedItems.length} ${mediaLabel}(s)`;
    const baseLabel = language === 'bn' ? `${countLabel} কিউতে যোগ করা হয়েছে` : `Added ${countLabel} to queue`;
    const successMsg = duplicateNotice ? (language === 'bn' ? `${countLabel} যোগ — ${duplicateNotice}` : `Added ${addedItems.length} item(s) — ${duplicateNotice}`) : baseLabel;
    setStatus(duplicateNotice ? `Queued — ${duplicateNotice}` : 'Queued');
    showToast(successMsg, 'success', duplicateNotice ? 3000 : 1500);
    // Clear link input and analyzed media section after successful Add to Queue as requested
    setUrl('');
    setAnalyses([]);
    setSelectedMediaIds([]);
    setActiveMediaId(null);
    setLastAnalyzeResult(null);
    setError(null);
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
    onClear: () => { setUrl(''); setError(null); setLastAnalyzeResult(null); },
    isLoading,
    status,
    error,
    lastAnalyzeResult,
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
    if (view === 'versions') {
      return <AdminVersionsView appId="kwl-video-downloader" />;
    }
    if (view === 'settings') return <SettingsView outputDirectory={outputDirectory} defaultOutputFolder={defaultOutputFolder} onOutputDirectoryChange={setOutputDirectory} onBrowse={handleBrowse} />;
    if (view === 'about') return <AboutViewWithVersions />;
    return <DownloaderView {...downloaderProps} />;
  })();

  const handleUpdateNow = async () => {
    if (!updateAvailable?.update) return;
    const hasActive = cartRef.current.some((it) => ACTIVE_CART_STATUSES.includes(it.status) || RUNNING_CART_STATUSES.includes(it.status));
    if (hasActive) {
      showToast(language === 'bn' ? 'ডাউনলোড চলছে — শেষ হলে আপডেট করুন।' : 'Downloads active — finish them before updating.', 'error', 3500);
      return;
    }
    setIsUpdating(true);
    try {
      showToast(language === 'bn' ? 'আপডেট ডাউনলোড হচ্ছে...' : 'Downloading update...', 'success', 2000);
      await updateAvailable.update.downloadAndInstall((ev) => {
        if (ev.event === 'Started') showToast(language === 'bn' ? 'ডাউনলোড শুরু...' : 'Download started...', 'success', 1500);
      });
      showToast(language === 'bn' ? 'ইনস্টল হয়েছে — রিস্টার্ট হচ্ছে...' : 'Update installed — restarting...', 'success', 1500);
      setTimeout(() => relaunch(), 800);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(language === 'bn' ? `আপডেট ব্যর্থ: ${msg.slice(0, 100)}` : `Update failed: ${msg.slice(0, 120)}`, 'error', 4000);
      setIsUpdating(false);
    }
  };
  const handleCancelUpdate = () => {
    setUpdateAvailable(null);
    try { localStorage.removeItem('kwl:update-available'); } catch {}
  };

  return (
    <>
      {mainContent}
      {updateAvailable && !isUpdating && (
        <div className="fixed inset-0 z-[998] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[6px]" onClick={handleCancelUpdate} aria-hidden="true" />
          <div role="alert" aria-live="assertive" className="relative w-full max-w-[440px] rounded-2xl border border-sky-400/30 bg-slate-900/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-[toastIn_0.22s_ease-out]">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300 border border-sky-400/20">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 16v-5" /><path d="M12 8h.01" /><circle cx="12" cy="12" r="10" /></svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[1rem] font-bold text-sky-100">{language === 'bn' ? `নতুন আপডেট v${updateAvailable.version} এসেছে` : `Update v${updateAvailable.version} available`}</p>
                <p className="mt-1 text-[0.88rem] leading-5 text-slate-300">{language === 'bn' ? 'আপডেট করবেন? Settings → Updates থেকেও করতে পারবেন।' : 'Install now? You can also update from Settings → Updates.'}</p>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={handleUpdateNow} className="rounded-xl bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)] px-4 py-2 text-sm font-bold text-white shadow hover:-translate-y-px transition"> {language === 'bn' ? 'Update' : 'Update'} </button>
                  <button type="button" onClick={handleCancelUpdate} className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700 transition"> {language === 'bn' ? 'Cancel' : 'Cancel'} </button>
                </div>
              </div>
              <button type="button" onClick={handleCancelUpdate} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition" aria-label="Close"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg></button>
            </div>
          </div>
          <style>{`@keyframes toastIn { from { opacity: 0; transform: translateY(10px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
        </div>
      )}
      {isUpdating && (
        <div className="fixed inset-0 z-[998] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[6px]" aria-hidden="true" />
          <div className="relative w-full max-w-[400px] rounded-2xl border border-sky-400/30 bg-slate-900/95 p-6 shadow-xl text-center">
            <svg className="h-8 w-8 animate-spin text-sky-400 mx-auto" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/><path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
            <p className="mt-3 text-sm font-bold text-sky-100">{language === 'bn' ? 'আপডেট ডাউনলোড হচ্ছে...' : 'Downloading update...'}</p>
            <p className="mt-1 text-xs text-slate-400">{language === 'bn' ? 'উইন্ডো বন্ধ করবেন না' : 'Do not close the window'}</p>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} duration={toast.duration ?? 1500} />}
    </>
  );
}

function AboutViewWithVersions() {
  // Closed source — VersionHistory hidden, AboutView handles privacy
  return <AboutView />;
}

export function App() {
  return <AppContent />;
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
