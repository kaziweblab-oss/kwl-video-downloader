import { ReactNode } from 'react';
import { useSettings } from '../store/settingsStore';

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
}: PanelHeaderProps) => {
  const { resolvedTheme } = useSettings();
  const isDark = resolvedTheme === 'dark';
  const labelColor = isDark ? 'text-kwl-text-label' : 'text-sky-700';
  return (
  <div
    className={`flex items-center justify-between gap-3 ${compact ? 'mb-3.5 max-[760px]:flex-col max-[760px]:items-stretch' : 'mb-[18px] max-[760px]:flex-col max-[760px]:items-stretch'} ${className}`}
  >
    <div className="flex min-w-0 items-center gap-2">
      <p className={`shrink-0 text-[0.72rem] uppercase tracking-[0.12em] ${labelColor}`}>{label}</p>
      {count != null && count !== '' && (
        <span className={`inline-flex h-5 shrink-0 items-center rounded-[10px] border px-2 text-[0.65rem] font-bold ${isDark ? 'border-kwl-brand-sky/25 bg-kwl-brand-cyan/20 text-kwl-brand-sky' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>
          {count}
        </span>
      )}
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
    {children && <div className="flex-shrink-0">{children}</div>}
  </div>
  );
};