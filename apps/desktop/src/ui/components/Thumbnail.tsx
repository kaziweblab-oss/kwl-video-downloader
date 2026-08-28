import { forwardRef, ImgHTMLAttributes } from 'react';

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
  ({ src, alt = '', size = 'md', fallback, className = '', ...props }, ref) => (
    <div
      className={`flex ${aspectClass} ${sizeClasses[size]} items-center justify-center overflow-hidden rounded-[10px] border border-kwl-brand-sky/25 bg-gradient-to-br from-kwl-brand-cyan/30 to-kwl-navy-900 text-[0.7rem] font-bold uppercase text-kwl-brand-sky ${className}`}
    >
      {src ? (
        <img
          ref={ref}
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          {...props}
        />
      ) : (
        fallback || <span>Media</span>
      )}
    </div>
  )
);

Thumbnail.displayName = 'Thumbnail';