import { getAppVersionInfo } from '@kwl/runtime';
import { AppShellState } from './types/app';

const DEFAULT_APP_NAME = 'KWL Video Downloader';
const DEFAULT_APP_VERSION = '1.0.0';

export function getAppShellState(): AppShellState {
  const appVersion = getAppVersionInfo(DEFAULT_APP_NAME, DEFAULT_APP_VERSION, 'windows');

  return {
    appState: 'idle',
    version: appVersion.version,
    name: appVersion.name,
  };
}
