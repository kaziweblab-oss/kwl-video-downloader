import { forwardRef, ButtonHTMLAttributes } from 'react';
import { useSettings } from '../store/settingsStore';

export interface OptionCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const OptionCard = forwardRef<HTMLButtonElement, OptionCardProps>(
  ({ selected = false, disabled = false, icon, children, className = '', ...props }, ref) => {
    const { resolvedTheme } = useSettings();
    const isDark = resolvedTheme === 'dark';
    return (
    <button
      ref={ref}
      disabled={disabled}
      className={`
        flex flex-col items-center justify-center gap-2
        min-w-[100px] flex-1
        rounded-[14px]
        border-2
        px-4 py-3
        text-center
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-sky-400/50
        disabled:opacity-50 disabled:cursor-not-allowed
        ${selected
          ? (isDark ? 'border-sky-400 bg-sky-500/15 text-sky-100 shadow-[0_0_16px_rgba(56,189,248,0.18)]' : 'border-sky-500 bg-sky-50 text-sky-700 shadow-[0_0_8px_rgba(14,165,233,0.16)]')
          : (isDark ? 'border-slate-700 bg-slate-800/70 text-slate-200 hover:border-sky-500/40 hover:bg-slate-800 hover:text-slate-50' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50')
        }
        ${className}
      `}
      {...props}
    >
      {icon && <span className={`h-5 w-5 ${selected ? (isDark ? 'text-sky-300' : 'text-sky-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>{icon}</span>}
      <span className={`text-sm font-bold ${selected ? (isDark ? 'text-sky-100' : 'text-sky-700') : (isDark ? 'text-slate-200' : 'text-slate-700')}`}>{children}</span>
    </button>
    );
  }
);

OptionCard.displayName = 'OptionCard';