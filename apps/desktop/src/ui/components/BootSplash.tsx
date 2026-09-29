import { useTranslations } from '../hooks/useTranslations';
import { useSettings } from '../store/settingsStore';

/**
 * Branded boot splash — original KWL identity (not a copy of any engine's
 * splash). Shown on first paint until the app signals readiness, so the
 * window never looks frozen while startup work finishes in the background.
 */
export const BootSplash = ({ visible }: { visible: boolean }) => {
  const t = useTranslations();
  const { resolvedTheme } = useSettings();
  const isDark = resolvedTheme !== 'light';
  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 transition-opacity duration-500 ${isDark ? 'bg-[#0a0f1e]' : 'bg-slate-50'} ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border-2 p-2.5 shadow-2xl ${isDark ? 'border-sky-400/40 bg-sky-500/10' : 'border-sky-300 bg-white'}`}>
        <img src="/kwl-logo.png" alt={t.aboutLogoAlt} className="h-full w-full object-contain" />
      </div>
      <div className="text-center">
        <h1 className={`m-0 text-2xl font-extrabold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>KWL Video Downloader</h1>
        <p className={`mt-1 text-sm font-bold ${isDark ? 'text-sky-300' : 'text-sky-600'}`}>{t.bootTagline}</p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className={`h-1.5 w-44 overflow-hidden rounded-full ${isDark ? 'bg-slate-700/70' : 'bg-slate-200'}`}>
          <div className="h-full w-1/3 rounded-full bg-sky-500" style={{ animation: 'shimmer 1.2s ease-in-out infinite' }} />
        </div>
        <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.bootLoading}</p>
      </div>
    </div>
  );
};
