import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Settings = {
  maxConcurrent: number;
  language: 'en' | 'bn';
};

const DEFAULT_SETTINGS: Settings = {
  maxConcurrent: 2,
  language: 'en',
};

const STORAGE_KEY = 'kwl:settings';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      const v = parsed.maxConcurrent;
      const lang = parsed.language;
      if (typeof v === 'number' && v >= 1 && v <= 10 && (lang === 'en' || lang === 'bn')) {
        return { maxConcurrent: v, language: lang };
      }
      if (typeof v === 'number' && v >= 1 && v <= 10) {
        return { maxConcurrent: v, language: 'en' };
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
  setMaxConcurrent: (n: number) => void;
  setLanguage: (lang: 'en' | 'bn') => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  setMaxConcurrent: () => {},
  setLanguage: () => {},
});

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const setMaxConcurrent = (n: number) => {
    const v = Math.max(1, Math.min(10, Math.round(n)));
    setSettings((prev) => ({ ...prev, maxConcurrent: v }));
  };

  const setLanguage = (lang: 'en' | 'bn') => {
    setSettings((prev) => ({ ...prev, language: lang }));
  };

  return (
    <SettingsContext.Provider value={{ settings, setMaxConcurrent, setLanguage }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
