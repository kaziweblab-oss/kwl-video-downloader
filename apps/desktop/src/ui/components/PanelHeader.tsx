import { ReactNode } from 'react';

export interface PanelHeaderProps {
  label: string;
  count?: number | string | null;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}

export const PanelHeader = ({
  label,
  count,
  action,
  children,
  className = '',
  compact = false,
}: PanelHeaderProps) => (
  <div
    className={`flex items-center justify-between gap-3 ${compact ? 'mb-3.5 max-[760px]:flex-col max-[760px]:items-stretch' : 'mb-[18px] max-[760px]:flex-col max-[760px]:items-stretch'} ${className}`}
  >
    <div className="flex items-center gap-2">
      <p className="text-[0.72rem] uppercase tracking-[0.12em] text-kwl-text-label">{label}</p>
      {count !== undefined && (
        <span className="inline-flex h-5 items-center rounded-[10px] border border-kwl-brand-sky/25 bg-kwl-brand-cyan/20 px-2 text-[0.65rem] font-medium text-kwl-brand-sky">
          {count}
        </span>
      )}
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
    {children && <div className="flex-shrink-0">{children}</div>}
  </div>
);