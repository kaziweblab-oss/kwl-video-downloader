import { useEffect, useState } from 'react';
import { Panel, PanelHeader } from '../components/Panel';
import { useSettings } from '../store/settingsStore';
import { useLanguage, useTranslations } from '../hooks/useTranslations';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'upToDate' | 'error';
type PendingUpdate = Awaited<ReturnType<typeof check>>;

export const AdminVersionsView = ({ appId = 'kwl-video-downloader' }: { appId?: string }) => {
  const { resolvedTheme } = useSettings();
  const isDark = resolvedTheme === 'dark';
  const { language } = useLanguage();
  const t = useTranslations();
  const [currentVersion, setCurrentVersion] = useState('1.0.2');
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate>(null);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

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
          if (parsed.version) setUpdateVersion(parsed.version);
        }
      } catch {}
    })();
    const onAvail = (e: Event) => {
      const detail = (e as CustomEvent).detail as { version?: string } | undefined;
      if (detail?.version) setUpdateVersion(detail.version);
    };
    window.addEventListener('kwl:update-available' as any, onAvail as any);
    return () => {
      cancelled = true;
      window.removeEventListener('kwl:update-available' as any, onAvail as any);
    };
  }, []);

  const handleCheck = async () => {
    if (updateState === 'downloading') return;
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
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error(language === 'bn' ? 'ইন্টারনেট নেই — আপডেট চেক করতে নেটওয়ার্ক লাগবে।' : 'Offline — need internet to check for updates.');
      }
      if (!('__TAURI_INTERNALS__' in globalThis)) {
        setUpdateState('error');
        setUpdateError('Updater only works in the desktop app, not in browser preview.');
        return;
      }
      const update = await check();
      if (!update) {
        setPendingUpdate(null);
        setUpdateState('upToDate');
      } else {
        setPendingUpdate(update);
        setUpdateVersion((update as any).version ?? 'newer');
        setUpdateState('available');
        try { localStorage.setItem('kwl:update-available', JSON.stringify({ version: (update as any).version ?? 'newer', at: Date.now() })); } catch {}
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const lower = raw.toLowerCase();
      if (lower.includes('404') || lower.includes('not found') || lower.includes('failed to fetch') || lower.includes('network') || lower.includes('offline') || lower.includes('valid json') || lower.includes('unexpected token') || (lower.includes('json') && lower.includes('parse')) || lower.includes('html')) {
        setPendingUpdate(null);
        setUpdateState('upToDate');
        setUpdateError(null);
      } else {
        const friendly = lower.includes('signature') || lower.includes('verify')
          ? (language === 'bn' ? 'আপডেট ভেরিফিকেশন ব্যর্থ — রিলিজ ফাইল যাচাই করা যায়নি।' : 'Update verification failed — release signature mismatch.')
          : raw.length > 180 ? raw.slice(0, 180) + '…' : raw;
        setUpdateError(friendly);
        setUpdateState('error');
      }
    }
  };

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader label={language === 'bn' ? 'আপডেট' : 'Updates'} count={null} compact>
          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>v{currentVersion} · {appId}</span>
        </PanelHeader>

        <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${isDark ? 'border-slate-700/30 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
          <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{language === 'bn' ? 'বর্তমান ভার্সন' : 'Current version'}</span>
          <span className={`text-sm font-extrabold ${isDark ? 'text-sky-200' : 'text-sky-600'}`}>v{currentVersion}</span>
        </div>

        <div className="mt-4">
          <p className={`text-xs leading-4 mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {language === 'bn'
              ? 'নতুন major আপডেট এলে এখানে দেখাবে — Download and Install এ ক্লিক করলে নতুন ভার্সন সাইলেন্টলি ডাউনলোড হবে, পুরনো ভার্সন রিমুভ হবে এবং নতুন ভার্সন ইনস্টল হবে।'
              : 'When a major update is available it will appear here — click Download and Install to silently download, remove the old version and install the new one.'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={updateState === 'checking' || updateState === 'downloading'}
              onClick={handleCheck}
              className={`${updateState === 'available' ? 'bg-[linear-gradient(135deg,#16a34a_0%,#15803d_100%)] hover:from-green-600 hover:to-green-700' : 'bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)]'} px-6 py-2.5 text-white rounded-xl border border-transparent font-bold transition hover:-translate-y-px disabled:pointer-events-none disabled:opacity-60 inline-flex items-center gap-2 shadow`}
            >
              {(updateState === 'checking' || updateState === 'downloading') && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/><path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
              )}
              {updateState === 'checking' ? (language === 'bn' ? 'চেক হচ্ছে…' : 'Checking…') : updateState === 'downloading' ? (language === 'bn' ? 'ডাউনলোড হচ্ছে…' : 'Downloading…') : updateState === 'available' ? (language === 'bn' ? `⬇ Download and Install v${updateVersion ?? ''}` : `⬇ Download and Install v${updateVersion ?? ''}`) : updateState === 'upToDate' ? (language === 'bn' ? 'পুনরায় চেক করুন' : 'Check Again') : (language === 'bn' ? 'আপডেট চেক করুন' : 'Check for Updates')}
            </button>
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {updateState === 'available' ? (language === 'bn' ? `v${updateVersion} রেডি — ইনস্টল করুন` : `v${updateVersion} ready — install now`) : updateState === 'error' ? (updateError ?? 'Check failed') : updateState === 'downloading' ? (language === 'bn' ? 'ইনস্টল হচ্ছে — অ্যাপ রিস্টার্ট হবে…' : 'Installing — app will restart…') : updateState === 'checking' ? (language === 'bn' ? 'চেক হচ্ছে…' : 'Checking…') : (language === 'bn' ? 'GitHub Releases থেকে চেক করে' : 'Checks GitHub Releases')}
            </span>
          </div>
          {updateState === 'available' && pendingUpdate && (
            <div className={`mt-4 rounded-xl border px-4 py-4 ${isDark ? 'border-sky-500/30 bg-sky-500/10' : 'border-sky-200 bg-sky-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${isDark ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-100 text-sky-600'}`}> <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14"/></svg></span>
                <p className={`text-sm font-bold ${isDark ? 'text-sky-200' : 'text-sky-700'}`}>v{updateVersion} {language === 'bn' ? 'রেডি — সাইলেন্ট ইনস্টল হবে' : 'ready — silent install'}</p>
              </div>
              {(pendingUpdate as any).body && <p className={`mt-2 text-xs whitespace-pre-wrap line-clamp-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{String((pendingUpdate as any).body).slice(0, 600)}</p>}
              <p className={`mt-2 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{language === 'bn' ? 'পুরনো ভার্সন অটো রিমুভ হবে, নতুন ভার্সন সাইলেন্টলি ইনস্টল হয়ে অ্যাপ রিস্টার্ট হবে।' : 'Old version will be removed automatically, new version will be installed silently and the app will restart.'}</p>
              <div className="mt-3">
                <button type="button" onClick={handleCheck} className="w-full bg-[linear-gradient(135deg,#16a34a_0%,#15803d_100%)] text-white rounded-xl px-4 py-3 text-sm font-bold shadow hover:-translate-y-px transition inline-flex items-center justify-center gap-2">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14"/><path d="M5 12l7 7 7-7" /></svg>
                  {language === 'bn' ? `⬇ Download and Install` : `⬇ Download and Install`}
                </button>
              </div>
            </div>
          )}
          {updateState === 'upToDate' && (
            <div className={`mt-4 rounded-xl border px-4 py-4 flex items-center gap-3 ${isDark ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50'}`}>
              <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-600'}`}>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-bold ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>{language === 'bn' ? 'কোনো আপডেট নেই' : 'No updates are available'}</p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-emerald-300/80' : 'text-emerald-600/80'}`}>{language === 'bn' ? `আপনি সর্বশেষ ভার্সন v${currentVersion} ব্যবহার করছেন` : `You are on the latest version v${currentVersion}`}</p>
              </div>
              <span className={`ml-auto text-[10px] px-2 py-1 rounded-full font-bold hidden sm:inline-flex ${isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white text-emerald-700 border border-emerald-200'}`}>✓ {language === 'bn' ? 'আপ টু ডেট' : 'Up to date'}</span>
            </div>
          )}
          {updateState === 'error' && updateError && (
            <p className="mt-3 text-xs text-red-500">{updateError}</p>
          )}
        </div>
      </Panel>
    </div>
  );
};
