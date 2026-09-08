export type AppState = 'idle' | 'analyzing' | 'ready' | 'error';

export interface AnalysisFormState {
  url: string;
  isLoading: boolean;
  error: string | null;
}

export interface AppShellState {
  appState: AppState;
  version: string;
  name: string;
}
