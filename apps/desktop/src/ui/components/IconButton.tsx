import { forwardRef, ButtonHTMLAttributes } from 'react';

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

const variantClasses = {
  default: 'border-kwl-panel-borderStrong bg-kwl-panel-bg hover:border-kwl-brand-sky/70 hover:bg-kwl-brand-cyan/25',
  danger: 'border-kwl-panel-borderStrong bg-kwl-panel-bg hover:border-kwl-status-failed/70 hover:bg-red-500/20 text-red-300 hover:text-red-200',
  primary: 'border-kwl-brand-sky/40 bg-kwl-brand-cyan/20 hover:border-kwl-brand-sky hover:bg-kwl-brand-cyan/30 text-kwl-brand-sky',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'default', size = 'md', className = '', children, 'aria-label': ariaLabel, ...props }, ref) => (
    <button
      ref={ref}
      className={`
        inline-flex items-center justify-center rounded-[9px] border
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-kwl-brand-sky/50
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </button>
  )
);

IconButton.displayName = 'IconButton';