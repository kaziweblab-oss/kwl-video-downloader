import { ReactNode } from 'react';

export type StatusVariant =
  | 'completed'
  | 'failed'
  | 'paused'
  | 'active'
  | 'downloading'
  | 'processing'
  | 'validating'
  | 'converting'
  | 'queued'
  | 'pending'
  | 'cancelled'
  | 'default';

const statusColors: Record<StatusVariant, { dot: string; text: string }> = {
  completed: { dot: 'bg-kwl-status-completed', text: 'text-green-300' },
  failed: { dot: 'bg-kwl-status-failed', text: 'text-red-300' },
  paused: { dot: 'bg-kwl-status-paused', text: 'text-amber-300' },
  active: { dot: 'bg-kwl-status-active', text: 'text-cyan-300' },
  downloading: { dot: 'bg-kwl-status-active', text: 'text-cyan-300' },
  processing: { dot: 'bg-kwl-status-active', text: 'text-cyan-300' },
  validating: { dot: 'bg-kwl-status-active', text: 'text-cyan-300' },
  converting: { dot: 'bg-kwl-status-active', text: 'text-cyan-300' },
  queued: { dot: 'bg-kwl-status-default', text: 'text-slate-400' },
  pending: { dot: 'bg-kwl-status-default', text: 'text-slate-400' },
  cancelled: { dot: 'bg-kwl-status-failed', text: 'text-red-300' },
  default: { dot: 'bg-kwl-status-default', text: 'text-slate-400' },
};

const statusLabels: Record<StatusVariant, string> = {
  completed: 'Completed',
  failed: 'Failed',
  paused: 'Paused',
  active: 'Active',
  downloading: 'Downloading',
  processing: 'Processing',
  validating: 'Validating',
  converting: 'Converting',
  queued: 'Queued',
  pending: 'Pending',
  cancelled: 'Cancelled',
  default: 'Unknown',
};

export interface StatusPillProps {
  status: StatusVariant;
  showDot?: boolean;
  showLabel?: boolean;
  className?: string;
  children?: ReactNode;
}

export const StatusPill = ({
  status,
  showDot = true,
  showLabel = true,
  className = '',
  children,
}: StatusPillProps) => {
  const colors = statusColors[status];
  const label = children || (showLabel ? statusLabels[status] : null);

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[0.72rem] font-medium uppercase ${colors.text} ${className}`}
    >
      {showDot && <span className={`h-2 w-2 rounded-full ${colors.dot}`} />}
      {label}
    </span>
  );
};