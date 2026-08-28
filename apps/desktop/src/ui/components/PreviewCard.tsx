import { Panel, PanelHeader } from './Panel';
import { Thumbnail } from './Thumbnail';
import { Icon } from './Icon';
import { useTranslations } from '../hooks/useTranslations';
import type { AnalysisState } from '../downloadFlow';

export interface PreviewCardProps {
  analysis: AnalysisState | null;
  mediaSelected: boolean;
  analyses?: AnalysisState[];
  selectedMediaIds?: string[];
}

export const PreviewCard = ({ analysis, mediaSelected, analyses = [], selectedMediaIds = [] }: PreviewCardProps) => {
  const t = useTranslations();
  const selectedList = analyses.filter((a) => selectedMediaIds.includes(a.id));
  const isMulti = selectedList.length > 1;

  return (
    <Panel className="flex h-full min-h-[280px] flex-col">
      <PanelHeader label={t.mediaPreview} count={isMulti ? `${selectedList.length} ${t.items}` : null} compact>
        <h3 className="m-0 text-lg font-bold tracking-tight">{t.mediaPreview}</h3>
      </PanelHeader>

      {!mediaSelected ? (
        <div className="grid flex-1 content-center justify-items-center gap-2 px-3 py-6 text-center">
          <Icon name="empty" />
          <p className="mt-3.5 text-[0.95rem] text-slate-400">{analysis ? t.selectMediaHint : t.previewEmpty}</p>
        </div>
      ) : isMulti ? (
        <div className="mt-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
          <ul className="m-0 grid list-none gap-3 p-0">
            {selectedList.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-3 rounded-xl border border-blue-400/20 bg-slate-900/50 p-3"
              >
                <Thumbnail src={entry.thumbnail} alt={entry.title} size="md" fallback={<span>{t.mediaFallback}</span>} />
                <div className="grid min-w-0 flex-1 gap-1">
                  <strong className="min-w-0 break-words text-sm leading-tight text-slate-50 line-clamp-2">{entry.title}</strong>
                  <span className="text-[0.78rem] text-slate-400 truncate">{entry.author} · {entry.duration} · {entry.sourceUrl ? new URL(entry.sourceUrl).hostname : 'Unknown'}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-3.5 max-[520px]:flex-col">
          <Thumbnail src={analysis?.thumbnail} alt={analysis?.title ?? ''} size="lg" fallback={<span>{t.mediaFallback}</span>} />
          <div className="grid min-w-0 gap-1">
            <strong className="min-w-0 break-words text-slate-50">{analysis?.title}</strong>
            <span className="text-[0.82rem] text-slate-400">{analysis?.author}</span>
            <span className="text-[0.82rem] text-slate-400">{t.duration}: {analysis?.duration}</span>
            <span className="text-[0.82rem] text-slate-400">{t.source}: {analysis?.sourceUrl ? new URL(analysis.sourceUrl).hostname : 'Unknown'}</span>
          </div>
        </div>
      )}
    </Panel>
  );
};