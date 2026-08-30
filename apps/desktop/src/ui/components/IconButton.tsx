import { forwardRef, ButtonHTMLAttributes } from 'react';
import { useSettings } from '../store/settingsStore';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'danger' | 'primary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
  'aria-label'?: string;
}

const sizeClasses = {
  sm: 'h-[28px] w-[28px]',
  md: 'h-[34px] w-[34px]',
  lg: 'h-[40px] w-[40px]',
};

function getVariantClasses(variant: 'default' | 'danger' | 'primary', isDark: boolean): string {
  if (variant === 'primary') {
    return isDark
      ? 'border-kwl-brand-sky/40 bg-kwl-brand-cyan/20 hover:border-kwl-brand-sky hover:bg-kwl-brand-cyan/30 text-kwl-brand-sky'
      : 'border-sky-200 bg-sky-50 hover:border-sky-400 hover:bg-sky-100 text-sky-600';
  }
  if (variant === 'danger') {
    return isDark
      ? 'border-kwl-panel-borderStrong bg-kwl-panel-bg hover:border-kwl-status-failed/70 hover:bg-red-500/20 text-red-300 hover:text-red-200'
      : 'border-slate-300 bg-white hover:border-red-300 hover:bg-red-50 text-slate-600 hover:text-red-600';
  }
  return isDark
    ? 'border-kwl-panel-borderStrong bg-kwl-panel-bg hover:border-kwl-brand-sky/70 hover:bg-kwl-brand-cyan/25 text-slate-300'
    : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50 text-slate-600';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'default', size = 'md', className = '', children, 'aria-label': ariaLabel, ...props }, ref) => {
    const { resolvedTheme } = useSettings();
    const isDark = resolvedTheme === 'dark';
    return (
    <button
      ref={ref}
      className={`
        inline-flex items-center justify-center rounded-[9px] border
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-kwl-brand-sky/50
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${getVariantClasses(variant, isDark)}
        ${className}
      `}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </button>
    );
  }
);

IconButton.displayName = 'IconButton';