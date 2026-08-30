import { useEffect, useState } from 'react';
import { Panel, PanelHeader } from '../components/Panel';
import { useTranslations, useLanguage } from '../hooks/useTranslations';
import { useSettings } from '../store/settingsStore';
import type { ThemeMode } from '../store/settingsStore';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useSettings();
  const modes: { key: ThemeMode; label: string }[] = [
    { key: 'system', label: 'System' },
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className={`inline-flex rounded-[10px] border p-1 w-fit ${resolvedTheme === 'dark' ? 'border-slate-400/25 bg-slate-900/70' : 'border-slate-300 bg-white'}`}>
        {modes.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setTheme(m.key)}
            className={theme === m.key
              ? `rounded-lg px-3 py-1.5 text-sm font-bold ${resolvedTheme === 'dark' ? 'bg-sky-400/20 text-sky-100' : 'bg-sky-100 text-sky-700'}`
              : `rounded-lg px-3 py-1.5 text-sm font-bold ${resolvedTheme === 'dark' ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-800'}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <span className={`text-xs break-words whitespace-normal ${resolvedTheme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Active: {resolvedTheme} {theme === 'system' ? '(following OS)' : ''}</span>
    </div>
  );
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'error' | 'upToDate';
type PendingUpdate = Awaited<ReturnType<typeof check>>;

export interface SettingsViewProps {
  outputDirectory?: string;
  defaultOutputFolder?: string;
  onOutputDirectoryChange?: (v: string) => void;
  onBrowse?: () => void;
}

export const SettingsView = ({ outputDirectory = '', defaultOutputFolder = '', onOutputDirectoryChange, onBrowse }: SettingsViewProps) => {
  const t = useTranslations();
  const { language, setLanguage } = useLanguage();
  const { settings, setMaxConcurrent, setAutoUpdate, setAutoLaunch, resolvedTheme } = useSettings();
  const isDark = resolvedTheme === 'dark';
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const [concurrentModalOpen, setConcurrentModalOpen] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState('1.0.3');

  // Show current app version and auto-detected update from App.tsx
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if ('__TAURI_INTERNALS__' in globalThis) {
          const { getAppInfo } = await import('../../native/tauriBridge');
          const info = await getAppInfo();
          if (!cancelled && info?.version) setCurrentVersion(info.version);
        }
      } catch {}
      try {
        const raw = localStorage.getItem('kwl:update-available');
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as { version?: string };
          if (parsed.version) {
            setUpdateVersion(parsed.version);
            // Don't auto-set available until user checks; just hint
          }
        }
      } catch {}
    })();
    const onAvail = (e: Event) => {
      const detail = (e as CustomEvent).detail as { version?: string } | undefined;
      if (detail?.version) {
        setUpdateVersion(detail.version);
        // Keep idle but show hint; user can click Check Now to verify
      }
    };
    window.addEventListener('kwl:update-available' as any, onAvail as any);
    return () => {
      cancelled = true;
      window.removeEventListener('kwl:update-available' as any, onAvail as any);
    };
  }, []);

  return (
    <div className="space-y-5">

      <Panel>
        <PanelHeader label="General" count={null} compact>
          <h3 className="m-0 text-lg font-bold tracking-tight">General</h3>
        </PanelHeader>

        <div className="space-y-4">
          <div>
            {(() => {
              const normalize = (p: string) => p.trim().replace(/[\\/]+$/, '').toLowerCase();
              const isDefault = normalize(outputDirectory) === normalize(defaultOutputFolder || 'C:\\Users\\Downloads\\KWL Video Downloader');
              return (
                <>
                  <div className="mb-2.5 flex items-center gap-2">
                    <label className={`block font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.defaultOutputFolder}</label>
                    {isDefault && <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${isDark ? 'border-sky-400/30 bg-sky-500/10 text-sky-300' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>Default</span>}
                  </div>
                  <div className="flex items-end gap-3 max-[760px]:flex-col max-[760px]:items-stretch">
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={outputDirectory || 'C:\\Users\\Downloads\\KWL Video Downloader'}
                        onChange={(e) => onOutputDirectoryChange?.(e.target.value)}
                        placeholder="C:\Users\Downloads\KWL Video Downloader"
                        className={`w-full min-w-[200px] flex-1 rounded-xl border px-4 py-[0.9rem] outline-none transition focus:border-sky-300/90 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.18)] ${isDark ? 'border-slate-400/40 bg-slate-900/80 text-slate-50' : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400'}`}
                      />
                    </div>
                    <button type="button" onClick={() => onBrowse?.()} aria-label={t.browse} title={t.browse} className={`shrink-0 rounded-xl border px-5 py-[0.9rem] text-sm font-bold transition ${isDark ? 'border-slate-400/30 bg-slate-800 text-slate-200 hover:border-sky-300/40 hover:bg-slate-700 hover:text-slate-50' : 'border-slate-300 bg-white text-slate-700 hover:border-sky-300 hover:bg-slate-50'}`}>{t.browse}</button>
                  </div>
                </>
              );
            })()}
          </div>

          <div>
            <label className={`mb-2.5 block font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Language</label>
            <div className={`inline-flex rounded-[10px] border p-1 ${isDark ? 'border-slate-400/25 bg-slate-900/70' : 'border-slate-300 bg-white'}`}>
              <button
                type="button"
                className={language === 'en' ? `rounded-lg px-[0.7rem] py-[0.4rem] font-bold ${isDark ? 'bg-sky-400/20 text-sky-100' : 'bg-sky-100 text-sky-700'}` : `rounded-lg px-[0.7rem] py-[0.4rem] font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
                onClick={() => setLanguage('en')}
              >
                EN
              </button>
              <button
                type="button"
                className={language === 'bn' ? `rounded-lg px-[0.7rem] py-[0.4rem] font-bold ${isDark ? 'bg-sky-400/20 text-sky-100' : 'bg-sky-100 text-sky-700'}` : `rounded-lg px-[0.7rem] py-[0.4rem] font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
                onClick={() => setLanguage('bn')}
              >
                BN
              </button>
            </div>
          </div>

          <div>
            <label className={`mb-2.5 block font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.theme}</label>
            <ThemeSwitcher />
          </div>

          {!isAndroid && (
            <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 max-[380px]:flex-col max-[380px]:items-stretch max-[380px]:gap-2.5 ${isDark ? 'border-slate-700/40 bg-slate-800/40' : 'border-slate-300 bg-slate-50'}`}>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Start up when sign in Windows</p>
                <p className="text-xs text-slate-500">When active, app auto opens after Windows login — deactive thakle open hobe na</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoLaunch}
                onClick={() => setAutoLaunch(!settings.autoLaunch)}
                className={`relative inline-flex h-7 w-12 shrink-0 self-center max-[380px]:self-end items-center rounded-full border transition ${settings.autoLaunch ? 'bg-sky-500 border-sky-400' : (isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-200 border-slate-300')}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${settings.autoLaunch ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader label="Advanced" count={null} compact>
          <h3 className="m-0 text-lg font-bold tracking-tight">Advanced</h3>
        </PanelHeader>

        <div className="space-y-4">
          <div>
            <label className={`mb-2.5 block font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.maxConcurrentLabel}</label>
            <button
              type="button"
              onClick={() => setConcurrentModalOpen(true)}
              className={`flex w-full max-w-[320px] items-center justify-between rounded-xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-300/50 ${isDark ? 'border-slate-400/30 bg-slate-900/80 text-slate-200 hover:border-sky-300/50 hover:bg-slate-800/80' : 'border-slate-300 bg-white text-slate-700 hover:border-sky-300'}`}
            >
              <span className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 border border-sky-400/20">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <span className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{settings.maxConcurrent} video{settings.maxConcurrent > 1 ? 's' : ''} at once</span>
                <span className={`ml-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>· Professional</span>
              </span>
              <span className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M8 9l4 4 4-4" /><path d="M16 15l-4-4-4 4" /></svg>
              </span>
            </button>
            <p className="mt-1.5 text-[0.72rem] text-slate-500">{t.maxConcurrentHint}</p>
            {concurrentModalOpen && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[6px]" onClick={() => setConcurrentModalOpen(false)} aria-hidden="true" />
                <div className={`relative w-full max-w-[420px] overflow-hidden rounded-2xl border shadow-[0_20px_60px_rgba(0,0,0,0.4)] flex flex-col ${isDark ? 'border-slate-700/50 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                  <div className={`flex items-center justify-between border-b px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                    <div>
                      <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t.concurrentDownloadsTitle}</h3>
                      <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.concurrentDownloadsDesc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConcurrentModalOpen(false)}
                      className={`rounded-xl border p-2 transition ${isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-slate-900'}`}
                      aria-label="Close"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="p-5 grid gap-2.5 grid-cols-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => { setMaxConcurrent(n); setConcurrentModalOpen(false); }}
                        className={`rounded-xl border px-4 py-3 text-left transition ${settings.maxConcurrent === n ? (isDark ? 'border-sky-400 bg-sky-500/15 text-sky-100 shadow-[0_0_0_2px_rgba(56,189,248,0.25)]' : 'border-sky-500 bg-sky-50 text-sky-700 shadow-[0_0_0_2px_rgba(14,165,233,0.18)]') : (isDark ? 'border-slate-700 bg-slate-800/70 text-slate-300 hover:border-slate-600 hover:bg-slate-800' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white')}`}
                      >
                        <span className="block text-base font-bold">{n} video{n > 1 ? 's' : ''}</span>
                        <span className={`block text-xs ${settings.maxConcurrent === n ? (isDark ? 'text-sky-200/80' : 'text-sky-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>{n === 1 ? t.sequential : n === 2 ? t.defaultConcurrent : n === 3 ? t.recommended : n === 5 ? t.maxConcurrent : `${n} parallel`}</span>
                      </button>
                    ))}
                  </div>
                  <div className={`flex items-center justify-between border-t px-5 py-3 ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50'}`}>
                    <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{t.currentConcurrent.replace('{count}', settings.maxConcurrent.toString())}</span>
                    <button
                      type="button"
                      onClick={() => setConcurrentModalOpen(false)}
                      className="rounded-xl bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)] px-5 py-2 text-sm font-bold text-white shadow hover:-translate-y-px transition"
                    >
                      {t.done}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader label="Updates" count={null} compact>
          <h3 className="m-0 text-lg font-bold tracking-tight">Updates</h3>
        </PanelHeader>

        <div className="space-y-4">
          <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 max-[380px]:flex-col max-[380px]:items-stretch max-[380px]:gap-2.5 ${isDark ? 'border-slate-700/40 bg-slate-800/40' : 'border-slate-300 bg-white'}`}>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Auto-check on startup</p>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{language === 'bn' ? 'আপডেট পাওয়া গেলে নোটিফিকেশন দেখাবে — এখান থেকে ম্যানুয়ালি ইনস্টল করুন' : 'Shows notification when update found — install manually from here'}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoUpdate}
              onClick={() => setAutoUpdate(!settings.autoUpdate)}
              className={`relative inline-flex h-7 w-12 shrink-0 self-center max-[380px]:self-end items-center rounded-full border transition ${settings.autoUpdate ? 'bg-sky-500 border-sky-400' : (isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-200 border-slate-300')}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${settings.autoUpdate ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className={`rounded-xl border px-4 py-2.5 flex items-center justify-between ${isDark ? 'border-slate-700/30 bg-slate-900/50' : 'border-slate-200 bg-slate-100'}`}>
            <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Current version</span>
            <span className={`text-sm font-extrabold ${isDark ? 'text-sky-200' : 'text-sky-600'}`}>v{currentVersion}</span>
          </div>

          <div>
            <label className={`mb-2.5 block font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.checkUpdates}</label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={updateState === 'checking' || updateState === 'downloading'}
                onClick={async () => {
                  if (updateState === 'downloading') return;
                  // If already available, download instead of re-checking
                  if (updateState === 'available' && pendingUpdate) {
                    setUpdateState('downloading');
                    setUpdateError(null);
                    try {
                      await pendingUpdate.downloadAndInstall(() => {});
                      await relaunch();
                    } catch (e) {
                      setUpdateError(e instanceof Error ? e.message : String(e));
                      setUpdateState('error');
                    }
                    return;
                  }
                  setUpdateState('checking');
                  setUpdateError(null);
                  setUpdateVersion(null);
                  try {
                    if (!('__TAURI_INTERNALS__' in globalThis)) {
                      setUpdateState('error');
                      setUpdateError('Updater only works in the desktop app, not in browser preview.');
                      return;
                    }
                    const update = await check();
                    if (!update) {
                      setPendingUpdate(null);
                      setUpdateState('upToDate');
                      setTimeout(() => setUpdateState('idle'), 3000);
                    } else {
                      setPendingUpdate(update);
                      setUpdateVersion((update as any).version ?? 'newer');
                      setUpdateState('available');
                    }
                  } catch (e) {
                    const raw = e instanceof Error ? e.message : String(e);
                    const lower = raw.toLowerCase();
                    // 404 / json parse / html means endpoint returned HTML not json — treat as up-to-date
                    if (lower.includes('404') || lower.includes('not found') || lower.includes('failed to fetch') || lower.includes('network') || lower.includes('offline') || lower.includes('valid json') || lower.includes('unexpected token') || (lower.includes('json') && lower.includes('parse')) || lower.includes('html')) {
                      setPendingUpdate(null);
                      setUpdateState('upToDate');
                      setUpdateError(null);
                      setTimeout(() => setUpdateState('idle'), 3000);
                    } else {
                      const friendly = lower.includes('signature') || lower.includes('verify')
                        ? (language === 'bn' ? 'আপডেট ভেরিফিকেশন ব্যর্থ — রিলিজ ফাইল যাচাই করা যায়নি।' : 'Update verification failed — release signature mismatch.')
                        : raw.length > 180 ? raw.slice(0, 180) + '…' : raw;
                      setUpdateError(friendly);
                      setUpdateState('error');
                    }
                  }
                }}
                className="bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)] px-[1.2rem] py-[0.9rem] text-slate-50 rounded-xl border border-transparent font-bold transition hover:-translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 max-[760px]:w-full max-[760px]:px-4 max-[760px]:py-[0.78rem] inline-flex items-center gap-2"
              >
                {(updateState === 'checking' || updateState === 'downloading') && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/><path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
                )}
                {updateState === 'checking' ? 'Checking…' : updateState === 'downloading' ? 'Downloading…' : updateState === 'available' ? `Download v${updateVersion ?? ''}` : t.checkNow}
              </button>
              <span className={`text-sm ${resolvedTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {updateState === 'upToDate' ? '✓ Already on latest version' : updateState === 'available' ? `Update v${updateVersion} available — click to install` : updateState === 'error' ? (updateError ?? 'Check failed') : updateState === 'downloading' ? 'Installing — app will restart…' : updateVersion && updateState === 'idle' ? `New v${updateVersion} detected — Check Now to install` : 'Checks GitHub Releases'}
              </span>
            </div>
            {updateState === 'available' && pendingUpdate && (
              <div className={`mt-3 rounded-xl border px-4 py-3 ${isDark ? 'border-sky-500/30 bg-sky-500/10' : 'border-sky-200 bg-sky-50'}`}>
                <p className={`text-sm font-bold ${isDark ? 'text-sky-200' : 'text-sky-700'}`}>v{updateVersion} available — {language === 'bn' ? 'ডাউনলোড করে রিস্টার্ট হবে' : 'will download and restart'}</p>
                {(pendingUpdate as any).body && <p className={`mt-1 text-xs line-clamp-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{String((pendingUpdate as any).body).slice(0, 400)}</p>}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => { setPendingUpdate(null); setUpdateState('idle'); try { localStorage.removeItem('kwl:update-available'); } catch {} }} className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${isDark ? 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>{language === 'bn' ? 'Cancel' : 'Cancel'}</button>
                  <span className={`text-xs self-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{language === 'bn' ? 'auto window বন্ধ হবে না — Update চাপলে ইনস্টল হবে' : 'window will not auto-close — press Update to install'}</span>
                </div>
              </div>
            )}
            {updateState === 'error' && updateError && (
              <p className="mt-2 text-xs text-red-400">{updateError}</p>
            )}
          </div>
        </div>
      </Panel>

      {/* Report Issue button hidden until KWL Nexus integration — will be re-added with Nexus */}
      {null}
    </div>
  );
};
