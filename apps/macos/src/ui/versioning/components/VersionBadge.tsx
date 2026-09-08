import type { VersionType } from '../types';
import { versionTypeLabel, versionTypeColor } from '../types';

export const VersionBadge = ({ type }: { type: VersionType }) => {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${versionTypeColor(type)}`}>
      {versionTypeLabel(type)}
    </span>
  );
};

export const LatestBadge = () => (
  <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
    Latest
  </span>
);
