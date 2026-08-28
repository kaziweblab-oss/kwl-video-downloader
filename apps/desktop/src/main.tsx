import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import { AppShell } from './ui/layout/AppShell';
import './index.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AppShell>
      <App />
    </AppShell>
  </React.StrictMode>,
);