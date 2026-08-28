import { ReactNode } from 'react';
import { ViewProvider, useView, type View } from '../store/viewStore';
import { useTranslations } from '../hooks/useTranslations';

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

const Sidebar = () => {
  const { view, setView } = useView();
  const t = useTranslations();

  const navItems: { key: View; label: string; icon: ReactNode }[] = [
    { key: 'downloader', label: t.navDownloader, icon: <HomeIcon /> },
    { key: 'queue', label: t.navQueue, icon: <QueueIcon /> },
    { key: 'history', label: t.navHistory, icon: <HistoryIcon /> },
    { key: 'settings', label: t.navSettings, icon: <SettingsIcon /> },
    { key: 'about', label: t.navAbout, icon: <InfoIcon /> },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-[240px] min-w-[240px] bg-kwl-navy-950 border-r border-kwl-panel-border flex flex-col">
      <div className="flex flex-col items-center py-6 px-4 border-b border-kwl-panel-border">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl border-2 border-kwl-brand-blue bg-kwl-brand-blue/10 mb-3">
          <span className="text-xl font-bold text-kwl-brand-sky">KWL</span>
        </div>
        <h1 className="text-lg font-semibold text-kwl-text-primary">KWL Video Downloader</h1>
      </div>

      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.key}>
              <button
                onClick={() => setView(item.key)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px]
                  text-kwl-text-secondary
                  transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-kwl-brand-sky/50
                  ${view === item.key
                    ? 'bg-kwl-brand-blue/15 border-l-3 border-kwl-brand-blue text-kwl-text-primary'
                    : 'hover:bg-white/5 hover:text-kwl-text-primary'
                  }
                `}
              >
                <span className="flex-shrink-0 text-kwl-brand-sky">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-kwl-panel-border">
        <p className="text-xs text-kwl-text-muted text-center">v1.0.0</p>
      </div>
    </aside>
  );
};

export interface AppShellProps {
  children: ReactNode;
}

export const AppShell = ({ children }: AppShellProps) => {
  return (
    <ViewProvider>
      <div className="min-h-screen bg-kwl-navy-900">
        <Sidebar />
        <main className="ml-[240px] min-h-screen max-[760px]:ml-0">
          <div className="mx-auto max-w-kwl-content px-5 pb-12 pt-8 max-[520px]:px-3 max-[520px]:pb-10 max-[520px]:pt-6">
            {children}
          </div>
        </main>
      </div>
    </ViewProvider>
  );
};