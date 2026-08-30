import { useEffect, useState } from 'react';
import { useSettings } from '../store/settingsStore';

async function getWindowControls() {
  try {
    if ('__TAURI_INTERNALS__' in globalThis) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      return getCurrentWindow();
    }
  } catch {}
  return null;
}

export const TitleBar = ({ onMenuToggle }: { onMenuToggle?: () => void }) => {
  const { resolvedTheme } = useSettings();
  const [isMaximized, setIsMaximized] = useState(false);
  const [appVersion, setAppVersion] = useState('1.0.2');

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      const win = await getWindowControls();
      if (!win) return;
      try {
        setIsMaximized(await win.isMaximized());
        unlisten = await win.onResized(async () => {
          try { setIsMaximized(await win.isMaximized()); } catch {}
        });
      } catch {}
    })();
    return () => { try { unlisten?.(); } catch {} };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if ('__TAURI_INTERNALS__' in globalThis) {
          const { getAppInfo } = await import('../../native/tauriBridge');
          const info = await getAppInfo();
          if (!cancelled && info?.version) setAppVersion(info.version);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const minimize = async () => {
    const win = await getWindowControls();
    await win?.minimize();
  };
  const toggleMaximize = async () => {
    const win = await getWindowControls();
    if (!win) return;
    if (await win.isMaximized()) await win.unmaximize();
    else await win.maximize();
  };
  const close = async () => {
    const win = await getWindowControls();
    await win?.close();
  };

  return (
    <div
      data-tauri-drag-region
      className={`
        h-9 min-h-9 flex items-center justify-between select-none
        border-b shrink-0
        ${resolvedTheme === 'dark'
          ? 'bg-[#030b16] border-white/10 text-slate-200'
          : 'bg-white border-slate-200 text-slate-800'}
      `}
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left: KWL branding + hamburger for small screens */}
      <div className="flex items-center gap-2.5 px-3 min-w-0" data-tauri-drag-region>
        {onMenuToggle && (
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={onMenuToggle}
            className={`min-[761px]:hidden inline-flex h-7 w-7 items-center justify-center rounded-lg border transition ${resolvedTheme === 'dark' ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" className="h-4 w-4">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
        )}
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border overflow-hidden ${resolvedTheme === 'dark' ? 'bg-kwl-brand-blue/15 border-kwl-brand-blue/30' : 'bg-sky-50 border-sky-200'}`}>
          <img src="/kwl-logo.png" alt="KWL" className="w-full h-full object-contain p-0.5" />
        </div>
        <span className={`text-[13px] font-semibold tracking-tight truncate ${resolvedTheme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>KWL Video Downloader</span>
        <span className={`hidden sm:inline text-[10px] font-medium px-1.5 py-0.5 rounded ml-1 ${resolvedTheme === 'dark' ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>v{appVersion}</span>
      </div>

      {/* Right: window controls */}
      <div className="flex items-stretch h-full shrink-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          type="button"
          onClick={minimize}
          aria-label="Minimize"
          className={`w-11 h-full inline-flex items-center justify-center transition ${resolvedTheme === 'dark' ? 'hover:bg-white/10 text-slate-400 hover:text-slate-100' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'}`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        </button>
        <button
          type="button"
          onClick={toggleMaximize}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
          className={`w-11 h-full inline-flex items-center justify-center transition ${resolvedTheme === 'dark' ? 'hover:bg-white/10 text-slate-400 hover:text-slate-100' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'}`}
        >
          {isMaximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2.5" y="2.5" width="7" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.1"/><path d="M3.5 3.5V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5H9" stroke="currentColor" strokeWidth="1.1" fill="none"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="2" width="8" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.1"/></svg>
          )}
        </button>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="w-11 h-full inline-flex items-center justify-center text-slate-400 hover:bg-[#ef4444] hover:text-white transition"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        </button>
      </div>
    </div>
  );
};
