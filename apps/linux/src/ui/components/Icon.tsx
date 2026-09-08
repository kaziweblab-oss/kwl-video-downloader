export function Icon({ name, className = 'h-[17px] w-[17px] fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]' }: { name: 'play' | 'folder' | 'retry' | 'close' | 'empty' | 'pause' | 'download' | 'trash' | 'check'; className?: string }) {
  if (name === 'play') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" className={className}><path d="m9 6 8 6-8 6V6Z" fill="currentColor" stroke="none" /></svg>;
  }

  if (name === 'pause') {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12" /></svg>;
  }

  if (name === 'check') {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>;
  }

  if (name === 'download') {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10" /><path d="m8 10 4 4 4-4" /><path d="M5 19h14" /></svg>;
  }

  if (name === 'trash') {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="m6 7 1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></svg>;
  }

  if (name === 'folder') {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5h6l2 2h9v9h-17v-11Z" /><path d="M3.5 9.5h17" /></svg>;
  }

  if (name === 'retry') {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.5-3L3 11" /><path d="M3 6v5h5" /><path d="M4 13a8 8 0 0 0 14.5 3L21 13" /><path d="M21 18v-5h-5" /></svg>;
  }

  if (name === 'close') {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>;
  }

  return (
    <svg className="h-14 w-[74px] fill-none stroke-sky-400 stroke-[1.5] opacity-75 [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 64 48" aria-hidden="true">
      <rect x="7" y="8" width="50" height="32" rx="8" />
      <path d="m24 20 8 5-8 5v-10Z" />
      <path d="M14 45h36" />
    </svg>
  );
}