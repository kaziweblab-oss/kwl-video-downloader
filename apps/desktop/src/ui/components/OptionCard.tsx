import { forwardRef, ButtonHTMLAttributes } from 'react';

export interface OptionCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const OptionCard = forwardRef<HTMLButtonElement, OptionCardProps>(
  ({ selected = false, disabled = false, icon, children, className = '', ...props }, ref) => (
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
        focus:outline-none focus:ring-2 focus:ring-kwl-brand-sky/50
        disabled:opacity-50 disabled:cursor-not-allowed
        ${selected
          ? 'border-kwl-brand-sky bg-kwl-brand-cyan/15 shadow-[0_0_16px_rgba(56,189,248,0.15)]'
          : 'border-kwl-panel-borderStrong bg-kwl-panel-bgStrong hover:border-kwl-brand-sky/40 hover:bg-kwl-brand-cyan/10'
        }
        ${className}
      `}
      {...props}
    >
      {icon && <span className="h-5 w-5 text-kwl-brand-sky">{icon}</span>}
      <span className="text-sm font-medium text-kwl-text-primary">{children}</span>
    </button>
  )
);

OptionCard.displayName = 'OptionCard';