import { useEffect, useState } from 'react';
import { Panel } from '../components/Panel';
import { ReportModal } from '../components/ReportModal';
import { getAppShellState } from '../../app';
import { useSettings } from '../store/settingsStore';
import { useTranslations } from '../hooks/useTranslations';

export const AboutView = () => {
  const shell = getAppShellState();
  const t = useTranslations();
  const { resolvedTheme } = useSettings();
  const isDark = resolvedTheme === 'dark';
  const [ver, setVer] = useState(shell.version);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showReport, setShowReport] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if ('__TAURI_INTERNALS__' in globalThis) {
          const { getAppInfo } = await import('../../native/tauriBridge');
          const info = await getAppInfo();
          if (!cancelled && info?.version) setVer(info.version);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <Panel padding="lg">
        <div className="grid justify-items-center gap-4 text-center">
          <div className={`flex items-center justify-center w-20 h-20 rounded-2xl border-2 overflow-hidden p-2 ${isDark ? 'border-kwl-brand-blue bg-kwl-brand-blue/10' : 'border-sky-300 bg-sky-50'}`}>
            <img src="/kwl-logo.png" alt="KWL Video Downloader Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className={`m-0 text-2xl font-bold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>KWL Video Downloader</h2>
            <p className={`mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t.aboutVersion} {ver}</p>
            <p className={`mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{t.aboutPlatform}</p>
          </div>

          <p className={`max-w-md ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {t.aboutDescription}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowPrivacy(true)}
              className={`px-[1.2rem] py-[0.9rem] rounded-xl border font-bold transition max-[760px]:w-full max-[760px]:px-4 max-[760px]:py-[0.78rem] ${isDark ? 'border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700' : 'border-slate-300 bg-slate-900 text-white hover:bg-black'}`}
            >
              {t.privacyPolicy}
            </button>
            <button
              type="button"
              onClick={() => setShowReport(true)}
              className={`px-[1.2rem] py-[0.9rem] rounded-xl border font-bold transition max-[760px]:w-full max-[760px]:px-4 max-[760px]:py-[0.78rem] ${isDark ? 'border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              {t.reportIssue}
            </button>
          </div>

          <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t.aboutProductOf}</p>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{t.aboutAllRightsReserved}</p>
        </div>
      </Panel>

      {showPrivacy && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[6px]" onClick={() => setShowPrivacy(false)} aria-hidden="true" />
          <div className={`relative w-full max-w-[560px] max-h-[75vh] overflow-hidden rounded-2xl border shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col ${isDark ? 'border-slate-700/50 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <div className={`flex items-center justify-between border-b px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t.aboutPrivacyTitle}</h3>
              <button type="button" onClick={() => setShowPrivacy(false)} className={`rounded-xl border p-2 transition ${isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'}`} aria-label="Close">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.aboutPrivacyContent}</p>
              <div className={`mt-4 rounded-lg border p-3 text-xs ${isDark ? 'border-slate-700 bg-slate-800/50 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                {t.aboutClosedSource}
              </div>
            </div>
            <div className={`flex justify-end border-t px-5 py-3 ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50'}`}>
              <button type="button" onClick={() => setShowPrivacy(false)} className="rounded-xl bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)] px-5 py-2 text-sm font-bold text-white shadow">OK</button>
            </div>
          </div>
        </div>
      )}

      <ReportModal open={showReport} onClose={() => setShowReport(false)} />
    </>
  );
};
