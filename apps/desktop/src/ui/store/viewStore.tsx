import { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from 'react';

export type View = 'downloader' | 'queue' | 'history' | 'settings' | 'about';

export interface ViewContextValue {
  view: View;
  setView: Dispatch<SetStateAction<View>>;
}

const ViewContext = createContext<ViewContextValue>({
  view: 'downloader' as View,
  setView: () => {},
});

export const ViewProvider = ({ children }: { children: ReactNode }) => {
  const [view, setView] = useState<View>('downloader');
  return <ViewContext.Provider value={{ view, setView }}>{children}</ViewContext.Provider>;
};

export const useView = (): ViewContextValue => useContext(ViewContext);