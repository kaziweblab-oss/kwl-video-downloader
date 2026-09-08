import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

export type Settings = {
  maxConcurrent: number;
  language: 'en' | 'bn';
  theme: ThemeMode;
  autoUpdate: boolean;
  autoLaunch: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  maxConcurrent: 2,
  language: 'en',
  theme: 'system',
  autoUpdate: true,
  autoLaunch: false,
};

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

async function applyThemeToWindow(theme: ThemeMode) {
  const resolved = resolveTheme(theme);
  // Apply to document
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-mode', theme);
  }
  // Apply to Tauri native window (title bar + window frame)
  try {
    if ('__TAURI_INTERNALS__' in globalThis) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      // Tauri 2: setTheme expects 'light' | 'dark' | null (null = system)
      // For 'system' we set the resolved system theme so native frame matches, but also listen for changes
      await win.setTheme(resolved as any);
    }
  } catch {}
}

const STORAGE_KEY = 'kwl:settings';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      const v = parsed.maxConcurrent;
      const lang = parsed.language;
      const th = parsed.theme;
      const au = parsed.autoUpdate;
      const al = parsed.autoLaunch;
      const theme: ThemeMode = th === 'light' || th === 'dark' || th === 'system' ? th : 'system';
      const autoUpdate = typeof au === 'boolean' ? au : DEFAULT_SETTINGS.autoUpdate;
      const autoLaunch = typeof al === 'boolean' ? al : DEFAULT_SETTINGS.autoLaunch;
      if (typeof v === 'number' && v >= 1 && v <= 10 && (lang === 'en' || lang === 'bn')) {
        return { maxConcurrent: v, language: lang, theme, autoUpdate, autoLaunch };
      }
      if (typeof v === 'number' && v >= 1 && v <= 10) {
        return { maxConcurrent: v, language: 'en', theme, autoUpdate, autoLaunch };
      }
      if (th !== undefined || au !== undefined || al !== undefined) {
        return { ...DEFAULT_SETTINGS, theme, autoUpdate, autoLaunch };
      }
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

interface SettingsContextValue {
  settings: Settings;
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setMaxConcurrent: (n: number) => void;
  setLanguage: (lang: 'en' | 'bn') => void;
  setTheme: (theme: ThemeMode) => void;
  setAutoUpdate: (v: boolean) => void;
  setAutoLaunch: (v: boolean) => void;
}

function getInitialSettings(): Settings {
  try { return loadSettings(); } catch { return DEFAULT_SETTINGS; }
}
function getInitialResolvedTheme(): 'light' | 'dark' {
  const s = getInitialSettings();
  if (s.theme !== 'system') return s.theme;
  return getSystemTheme();
}
const SettingsContext = createContext<SettingsContextValue>({
  settings: getInitialSettings(),
  theme: getInitialSettings().theme,
  resolvedTheme: getInitialResolvedTheme(),
  setMaxConcurrent: () => {},
  setLanguage: () => {},
  setTheme: () => {},
  setAutoUpdate: () => {},
  setAutoLaunch: () => {},
});

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => getSystemTheme());

  const theme = settings.theme;
  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Apply theme to document + native window on change (use resolved)
  useEffect(() => {
    void applyThemeToWindow(theme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', resolvedTheme);
    }
  }, [theme, resolvedTheme]);

  // Listen to system theme changes — keep React resolvedTheme in sync
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const next = (e as MediaQueryListEvent).matches ? 'dark' : 'light';
      setSystemTheme(next);
      if (theme === 'system') void applyThemeToWindow('system');
    };
    // init sync
    setSystemTheme(mq.matches ? 'dark' : 'light');
    if (mq.addEventListener) mq.addEventListener('change', onChange as (e: MediaQueryListEvent) => void);
    else mq.addListener(onChange as any);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange as (e: MediaQueryListEvent) => void);
      else mq.removeListener(onChange as any);
    };
  }, [theme]);

  const setMaxConcurrent = (n: number) => {
    const v = Math.max(1, Math.min(10, Math.round(n)));
    setSettings((prev) => ({ ...prev, maxConcurrent: v }));
  };

  const setLanguage = (lang: 'en' | 'bn') => {
    setSettings((prev) => ({ ...prev, language: lang }));
  };

  const setTheme = (t: ThemeMode) => {
    setSettings((prev) => ({ ...prev, theme: t }));
  };

  const setAutoUpdate = (v: boolean) => {
    setSettings((prev) => ({ ...prev, autoUpdate: v }));
  };

  const setAutoLaunch = (v: boolean) => {
    setSettings((prev) => ({ ...prev, autoLaunch: v }));
    // sync to OS autostart registry via Tauri (best effort, no throw)
    void (async () => {
      try {
        if ('__TAURI_INTERNALS__' in globalThis) {
          const { invoke } = await import('@tauri-apps/api/core');
          await (invoke as any)('set_autostart_enabled', { enabled: v });
        }
      } catch {}
    })();
  };

  // on mount, sync persisted autoLaunch state to OS (ensures registry matches settings after update)
  useEffect(() => {
    void (async () => {
      try {
        if ('__TAURI_INTERNALS__' in globalThis) {
          const { invoke } = await import('@tauri-apps/api/core');
          const enabled = await (invoke as any)('get_autostart_enabled') as boolean;
          if (typeof enabled === 'boolean' && enabled !== settings.autoLaunch) {
            setSettings((prev) => ({ ...prev, autoLaunch: enabled }));
          } else if (settings.autoLaunch) {
            // ensure registry if user had it enabled before
            await (invoke as any)('set_autostart_enabled', { enabled: true });
          }
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, theme, resolvedTheme, setMaxConcurrent, setLanguage, setTheme, setAutoUpdate, setAutoLaunch }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
