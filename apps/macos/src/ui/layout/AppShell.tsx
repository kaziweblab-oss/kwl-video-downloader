import { ReactNode, useRef, useState, useCallback, useEffect } from 'react';
import { ViewProvider, useView, type View } from '../store/viewStore';
import { useTranslations } from '../hooks/useTranslations';
import { TitleBar } from '../components/TitleBar';
import { useSettings } from '../store/settingsStore';

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function VersionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

const Sidebar = ({ open, onClose }: { open?: boolean; onClose?: () => void }) => {
  const { view, setView } = useView();
  const t = useTranslations();
  const { resolvedTheme } = useSettings();
  const [appVersion, setAppVersion] = useState('1.0.3');

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

  const navItems: { key: View; label: string; icon: ReactNode }[] = [
    { key: 'downloader', label: t.navDownloader, icon: <HomeIcon /> },
    { key: 'queue', label: t.navQueue, icon: <QueueIcon /> },
    { key: 'history', label: t.navHistory, icon: <HistoryIcon /> },
    { key: 'versions', label: 'Versions', icon: <VersionsIcon /> },
    { key: 'settings', label: t.navSettings, icon: <SettingsIcon /> },
    { key: 'about', label: t.navAbout, icon: <InfoIcon /> },
  ];

  const isDark = resolvedTheme === 'dark';
  const isMobileOpen = open ?? true;
  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-[240px] min-w-[240px] border-r flex flex-col transition-transform duration-300 ease-out ${isDark ? 'bg-kwl-navy-950 border-kwl-panel-border' : 'bg-white border-slate-200'} max-[760px]:shadow-2xl ${isMobileOpen ? 'max-[760px]:translate-x-0' : 'max-[760px]:-translate-x-full'} min-[761px]:translate-x-0`}>
      <div className={`flex flex-col items-center py-6 px-4 border-b ${isDark ? 'border-kwl-panel-border' : 'border-slate-200'}`}>
        <div className={`flex items-center justify-center w-14 h-14 rounded-xl border-2 mb-3 overflow-hidden shrink-0 ${isDark ? 'border-kwl-brand-blue bg-kwl-brand-blue/10' : 'border-sky-200 bg-sky-50'}`}>
          <img src="/kwl-logo.png" alt="KWL Logo" className="w-full h-full object-contain p-1" />
        </div>
        <h1 className={`text-lg font-semibold ${isDark ? 'text-kwl-text-primary' : 'text-slate-800'}`}>KWL Video Downloader</h1>
      </div>

      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.key}>
              <button
                onClick={() => { setView(item.key); if (onClose) onClose(); }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px]
                  transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-kwl-brand-sky/50
                  ${view === item.key
                    ? (isDark ? 'bg-kwl-brand-blue/15 border-l-4 border-kwl-brand-blue text-kwl-text-primary' : 'bg-sky-100 border-l-4 border-sky-500 text-sky-900')
                    : (isDark ? 'text-kwl-text-secondary hover:bg-white/5 hover:text-kwl-text-primary' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800')
                  }
                `}
              >
                <span className={`flex-shrink-0 ${isDark ? 'text-kwl-brand-sky' : 'text-sky-600'}`}>{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className={`p-4 border-t ${isDark ? 'border-kwl-panel-border' : 'border-slate-200'}`}>
        <p className={`text-xs text-center ${isDark ? 'text-kwl-text-muted' : 'text-slate-500'}`}>v{appVersion}</p>
      </div>
    </aside>
  );
};

export interface AppShellProps {
  children: ReactNode;
}

export const AppShell = ({ children }: AppShellProps) => {
  const { resolvedTheme } = useSettings();
  const mainRef = useRef<HTMLElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);

  // Track online/offline — app must always open offline; only in-app actions show network error
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    // ensure WebView never shows ERR_INTERNET_DISCONNECTED — suppress navigation to external URLs when offline
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!navigator.onLine) {
        // prevent Chrome error page from replacing app shell
        e.preventDefault();
      }
    };
    // Initial check
    setIsOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeunload', onBeforeUnload as any);
    };
  }, []);

  // Close sidebar on resize to desktop width
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 760) setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullOffset, setPullOffset] = useState(0);
  const touchStartY = useRef<number | null>(null);
  const lastRefreshAt = useRef(0);
  const lastScrollTop = useRef(0);
  const wheelIdleRef = useRef<number | null>(null);
  const PULL_THRESHOLD = 78;
  const PULL_MAX = 96;
  const COOLDOWN_MS = 1800;

  const triggerRefresh = useCallback(() => {
    const now = Date.now();
    if (isRefreshing) return;
    if (now - lastRefreshAt.current < COOLDOWN_MS) return;
    lastRefreshAt.current = now;
    setIsRefreshing(true);
    window.dispatchEvent(new CustomEvent('kwl:refresh'));
    // soft refresh completes via App.tsx; auto-reset spinner after delay as fallback
    window.setTimeout(() => setIsRefreshing(false), 1100);
  }, [isRefreshing]);

  useEffect(() => {
    const onComplete = () => { setIsRefreshing(false); setPullOffset(0); if (wheelIdleRef.current) { window.clearTimeout(wheelIdleRef.current); wheelIdleRef.current = null; } };
    window.addEventListener('kwl:refresh-complete' as unknown as string, onComplete as EventListener);
    return () => { window.removeEventListener('kwl:refresh-complete' as unknown as string, onComplete as EventListener); if (wheelIdleRef.current) window.clearTimeout(wheelIdleRef.current); };
  }, []);

  // Professional pull-to-refresh: ONLY deliberate pull at very top triggers — no auto-trigger from normal scroll to top
  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const curTop = el.scrollTop;
    lastScrollTop.current = curTop;
    const atTop = curTop <= 2;
    if (!atTop) {
      if (pullOffset > 0 && !isRefreshing) setPullOffset(0);
    }
  }, [isRefreshing, pullOffset]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((mainRef.current?.scrollTop ?? 0) <= 2) touchStartY.current = e.touches[0]?.clientY ?? null;
    else touchStartY.current = null;
  }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    if ((mainRef.current?.scrollTop ?? 0) > 2) return;
    const curY = e.touches[0]?.clientY ?? 0;
    const delta = curY - touchStartY.current;
    if (delta > 0) {
      // dampened pull distance for natural feel — scroll barale rotate barbe, komale kombe
      const dampened = Math.min(delta * 0.42, PULL_MAX);
      setPullOffset(dampened);
      // prevent native overscroll glow when pulling
      if (dampened > 8 && e.cancelable) e.preventDefault();
    } else {
      setPullOffset(0);
    }
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current == null) {
      setPullOffset(0);
      return;
    }
    const delta = (e.changedTouches[0]?.clientY ?? 0) - touchStartY.current;
    touchStartY.current = null;
    const shouldRefresh = delta * 0.42 >= PULL_THRESHOLD && (mainRef.current?.scrollTop ?? 0) <= 2;
    setPullOffset(0);
    if (shouldRefresh) { triggerRefresh(); }
  }, [triggerRefresh]);
  const handleTouchCancel = useCallback(() => {
    touchStartY.current = null;
    setPullOffset(0);
  }, []);

  // Pointer (mouse drag) support for desktop: drag down from top to pull
  const pointerStartY = useRef<number | null>(null);
  const isPointerDown = useRef(false);
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((mainRef.current?.scrollTop ?? 0) > 2) return;
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    isPointerDown.current = true;
    pointerStartY.current = e.clientY;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPointerDown.current || pointerStartY.current == null) return;
    if ((mainRef.current?.scrollTop ?? 0) > 2) return;
    const delta = e.clientY - pointerStartY.current;
    if (delta > 0) {
      const dampened = Math.min(delta * 0.42, PULL_MAX);
      setPullOffset(dampened);
      if (dampened > 8) e.preventDefault();
    } else {
      setPullOffset(0);
    }
  }, []);
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isPointerDown.current || pointerStartY.current == null) {
      setPullOffset(0);
      isPointerDown.current = false;
      return;
    }
    const delta = e.clientY - pointerStartY.current;
    isPointerDown.current = false;
    pointerStartY.current = null;
    const shouldRefresh = delta * 0.42 >= PULL_THRESHOLD && (mainRef.current?.scrollTop ?? 0) <= 2;
    setPullOffset(0);
    if (shouldRefresh) { triggerRefresh(); }
  }, [triggerRefresh]);

  // Auto-reset stuck pull if scroll moves away from top or after idle (professional spring-back)
  useEffect(() => {
    if (!isRefreshing && pullOffset > 0) {
      const t = window.setTimeout(() => {
        if ((mainRef.current?.scrollTop ?? 0) > 5) setPullOffset(0);
      }, 350);
      return () => window.clearTimeout(t);
    }
  }, [pullOffset, isRefreshing]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const atTop = (mainRef.current?.scrollTop ?? 0) <= 2;
    if (!atTop || isRefreshing) return;
    if (e.deltaY < 0) {
      // ekbare upore thakte deliberate pull korle e refresh — light scroll e trigger hobe na
      const inc = Math.min(Math.abs(e.deltaY) * 0.32, 22);
      if (e.cancelable) e.preventDefault();
      setPullOffset((prev) => Math.min(prev + inc * 0.42, PULL_MAX));
      if (wheelIdleRef.current) window.clearTimeout(wheelIdleRef.current);
      wheelIdleRef.current = window.setTimeout(() => {
        setPullOffset((cur) => {
          if (cur >= PULL_THRESHOLD) { triggerRefresh(); return 0; }
          return 0;
        });
      }, 180);
    } else if (e.deltaY > 0 && pullOffset > 0) {
      // scrolling down while pulled — cancel pull
      setPullOffset(0);
      if (wheelIdleRef.current) { window.clearTimeout(wheelIdleRef.current); wheelIdleRef.current = null; }
    }
  }, [isRefreshing, triggerRefresh]);

  const isPullActive = pullOffset > 0;
  const pullProgress = Math.min(pullOffset / PULL_THRESHOLD, 1);
  const showPullIndicator = isPullActive || isRefreshing;
  // rotate proportional to pull: 0→360 deg, full complete hole refresh
  const rotateDeg = pullProgress * 360;

  return (
    <ViewProvider>
      <div className={`app-container h-screen min-h-screen flex flex-col overflow-hidden ${resolvedTheme === 'dark' ? 'bg-[#030b16] bg-kwl-navy-900' : 'bg-slate-100'}`}>
        <TitleBar onMenuToggle={() => setSidebarOpen((o) => !o)} />
        {isOffline && (
          <div className={`flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold border-b shrink-0 ${resolvedTheme === 'dark' ? 'bg-amber-500/10 border-amber-500/20 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-700'}`} role="status" aria-live="polite">
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9a3 3 0 0 1 5.12 2.12M9.75 16.5a3 3 0 0 0 4.5 0M16.72 12.79A6 6 0 0 0 12 9a6 6 0 0 0-4.72 2.79M12 21a9 9 0 0 0 6.5-2.76M12 21a9 9 0 0 1-6.5-2.76" /></svg>
            <span>Offline — app works offline. Network actions will show error.</span>
          </div>
        )}
        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          {/* Mobile backdrop when sidebar open */}
          {sidebarOpen && (
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] min-[761px]:hidden"
            />
          )}
          <main
            ref={mainRef}
            onScroll={handleScroll}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
            className={`main-content flex-1 ml-[240px] min-h-0 max-[760px]:ml-0 h-full overflow-y-auto overscroll-contain custom-scrollbar ${resolvedTheme === 'dark' ? 'bg-[#030b16] bg-kwl-navy-900' : 'bg-slate-100'}`}
            style={{ WebkitOverflowScrolling: 'touch' as unknown as string } as React.CSSProperties}
          >
            {/* Pull-to-refresh indicator — top */}
            <div
              className="flex justify-center overflow-hidden transition-all duration-200 ease-out will-change-[height]"
              style={{ height: showPullIndicator ? (isRefreshing ? 52 : pullOffset) : 0, opacity: showPullIndicator ? 1 : 0 }}
              aria-hidden
            >
              <div className={`flex items-center gap-2 py-3 select-none ${resolvedTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {isRefreshing ? (
                  <>
                    <svg className="h-5 w-5 animate-spin text-sky-400" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/><path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
                    <span className="text-sm font-medium">Refreshing...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="h-5 w-5 text-sky-400"
                      style={{ transform: `rotate(${rotateDeg}deg)`, transition: isPullActive ? 'none' : 'transform 200ms ease-out' }}
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                    >
                      {/* circular rotate icon — scroll barale rotate barbe */}
                      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                      <polyline points="21 3 21 9 15 9" />
                    </svg>
                    <span className="text-sm font-medium">{pullProgress >= 1 ? 'Release to refresh' : 'Pull to refresh'}</span>
                  </>
                )}
              </div>
            </div>
            <div
              className="mx-auto max-w-kwl-content px-5 pb-12 pt-8 max-[520px]:px-3 max-[520px]:pb-10 max-[520px]:pt-6"
              style={{ transform: isPullActive ? `translateY(${pullOffset * 0.22}px)` : undefined, transition: isPullActive ? 'none' : 'transform 220ms ease-out' }}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </ViewProvider>
  );
};