import { ReactNode, forwardRef } from 'react';
import { PanelHeader, type PanelHeaderProps } from './PanelHeader';
import { useSettings } from '../store/settingsStore';

export interface PanelProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ children, className = '', padding = 'lg' }, ref) => {
    const { resolvedTheme } = useSettings();
    const paddingClasses = {
      none: '',
      sm: 'p-4 max-[760px]:p-3',
      md: 'p-6 max-[760px]:p-4',
      lg: 'p-[22px] max-[760px]:p-4',
    };
    const themeClasses = resolvedTheme === 'dark'
      ? 'border-kwl-panel-border bg-kwl-panel-bg shadow-kwl-panel'
      : 'border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]';

    return (
      <div
        ref={ref}
        className={`min-w-0 rounded-kwl-lg border ${themeClasses} ${paddingClasses[padding]} ${className}`}
      >
        {children}
      </div>
    );
  }
);

Panel.displayName = 'Panel';

export { PanelHeader, type PanelHeaderProps };