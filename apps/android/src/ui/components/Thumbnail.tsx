import { forwardRef, ImgHTMLAttributes, useState, useEffect } from 'react';

export interface ThumbnailProps extends ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  fallback?: React.ReactNode;
  className?: string;
}

const sizeClasses = {
  sm: 'w-[60px] max-[520px]:w-[52px]',
  md: 'w-[72px] max-[520px]:w-[60px]',
  lg: 'w-[132px]',
};

const aspectClass = 'aspect-[16/10]';

export const Thumbnail = forwardRef<HTMLImageElement, ThumbnailProps>(
  ({ src, alt = '', size = 'md', fallback, className = '', onError, ...props }, ref) => {
    const [failed, setFailed] = useState(false);
    useEffect(() => { setFailed(false); }, [src]);
    const showImage = !!src && !failed;
    return (
      <div
        className={`flex ${aspectClass} ${sizeClasses[size]} items-center justify-center overflow-hidden rounded-[10px] border border-kwl-brand-sky/25 bg-gradient-to-br from-kwl-brand-cyan/30 to-kwl-navy-950 text-[0.7rem] font-bold uppercase text-kwl-brand-sky ${className}`}
      >
        {showImage ? (
          <img
            ref={ref}
            src={src}
            alt={alt}
            className="h-full w-full object-cover object-center"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              setFailed(true);
              onError?.(e as any);
            }}
            {...props}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 px-1 text-center">
            <svg className="h-5 w-5 shrink-0 text-sky-300/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5" width="14" height="12" rx="2" />
              <path d="M17 9l4-2v8l-4-2z" />
            </svg>
            <span className="max-w-full truncate text-[0.62rem] font-extrabold tracking-wide text-sky-200/90">{fallback || 'VIDEO'}</span>
          </div>
        )}
      </div>
    );
  }
);

Thumbnail.displayName = 'Thumbnail';