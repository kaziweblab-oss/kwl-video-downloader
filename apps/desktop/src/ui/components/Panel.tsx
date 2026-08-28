import { ReactNode, forwardRef } from 'react';
import { PanelHeader, type PanelHeaderProps } from './PanelHeader';

export interface PanelProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ children, className = '', padding = 'lg' }, ref) => {
    const paddingClasses = {
      none: '',
      sm: 'p-4 max-[760px]:p-3',
      md: 'p-6 max-[760px]:p-4',
      lg: 'p-[22px] max-[760px]:p-4',
    };

    return (
      <div
        ref={ref}
        className={`min-w-0 rounded-kwl-lg border border-kwl-panel-border bg-kwl-panel-bg shadow-kwl-panel ${paddingClasses[padding]} ${className}`}
      >
        {children}
      </div>
    );
  }
);

Panel.displayName = 'Panel';

export { PanelHeader, type PanelHeaderProps };