import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import { AppShell } from './ui/layout/AppShell';
import { SettingsProvider } from './ui/store/settingsStore';
import { TranslationProvider } from './ui/hooks/useTranslations';
import './index.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <SettingsProvider>
      <TranslationProvider>
        <AppShell>
          <App />
        </AppShell>
      </TranslationProvider>
    </SettingsProvider>
  </React.StrictMode>,
);