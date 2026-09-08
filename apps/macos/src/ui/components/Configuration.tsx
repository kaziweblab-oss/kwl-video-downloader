import { Panel } from './Panel';
import { OptionCard } from './OptionCard';
import { useTranslations } from '../hooks/useTranslations';
import { useSettings } from '../store/settingsStore';
import { formatOptionsFor, formatBytesForDisplay, getSelectedFormatSize, qualityOptionsFor, qualityTiersWithDimensions, dimensionLabel, type FlowAnalysis, type FlowResolution, type QualityTier, type WizardStepId, type SelectedSize } from '../downloadFlow';

type MediaType = 'Video' | 'Audio';

export interface ConfigurationProps {
  mediaSelected: boolean;
  mediaType: MediaType;
  mediaTypeChosen: boolean;
  selectedFormat: string;
  formatChosen: boolean;
  selectedQuality: string;
  qualityChosen: boolean;
  selectedDimension: FlowResolution | null;
  outputDirectory: string;
  onMediaTypePick: (type: MediaType) => void;
  onFormatPick: (format: string) => void;
  onQualityPick: (quality: string) => void;
  onDimensionPick: (dimension: FlowResolution) => void;
  onOutputDirectoryChange: (dir: string) => void;
  onBrowse: () => void;
  onAddToQueue: () => void;
  canAdd: boolean;
  error: string | null;
  flowAnalysis: FlowAnalysis | null;
  wizardStep: WizardStepId;
  wizardSteps: WizardStepId[];
  onWizardNext: () => void;
  onWizardBack: () => void;
  onStepClick: (step: WizardStepId) => void;
  queueCount?: number;
  onGoToQueue?: () => void;
  selectedSize?: SelectedSize | null;
}

const STEP_LABELS: Record<WizardStepId, string> = {
  media: 'MEDIA',
  type: 'TYPE',
  format: 'FORMAT',
  quality: 'QUALITY',
  output: 'OUTPUT',
};

export const Configuration = ({
  mediaSelected,
  mediaType,
  mediaTypeChosen,
  selectedFormat,
  formatChosen,
  selectedQuality,
  qualityChosen,
  selectedDimension,
  outputDirectory,
  onMediaTypePick,
  onFormatPick,
  onQualityPick,
  onDimensionPick,
  onOutputDirectoryChange,
  onBrowse,
  onAddToQueue,
  canAdd,
  error,
  flowAnalysis,
  wizardStep,
  wizardSteps,
  onWizardNext,
  onWizardBack,
  onStepClick,
  queueCount = 0,
  onGoToQueue,
  selectedSize,
}: ConfigurationProps) => {
  const t = useTranslations();
  const { resolvedTheme } = useSettings();
  const isDark = resolvedTheme === 'dark';

  const isStepCompletedByData = (step: WizardStepId): boolean => {
    switch (step) {
      case 'media': return mediaSelected;
      case 'type': return mediaTypeChosen;
      case 'format': return formatChosen;
      case 'quality': return qualityChosen;
      case 'output': return outputDirectory.trim().length > 0;
    }
  };
  // Chain shows completed only up to current step, future steps stay locked even if data pre-selected
  const isStepCompleted = (step: WizardStepId): boolean => {
    const curIdx = wizardSteps.indexOf(wizardStep);
    const targetIdx = wizardSteps.indexOf(step);
    if (targetIdx < 0 || curIdx < 0) return false;
    if (targetIdx >= curIdx) return false;
    return isStepCompletedByData(step);
  };

  const canProceedCurrent = isStepCompletedByData(wizardStep);
  const isLastStep = wizardSteps.indexOf(wizardStep) === wizardSteps.length - 1;
  const isFirstStep = wizardSteps.indexOf(wizardStep) === 0;

  const renderStepContent = () => {
    switch (wizardStep) {
      case 'media':
        return (
          <div>
            <p className={`text-sm font-bold mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.selectMediaTitle}</p>
            <p className={`text-[0.9rem] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t.selectMediaDesc}
            </p>
          </div>
        );
      case 'type':
        return (
          <div>
            <p className={`text-sm font-bold mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.mediaType}</p>
            <div className="flex flex-nowrap gap-3" role="tablist" aria-label="Media type selector">
              {(['Video', 'Audio'] as MediaType[]).map((option) => (
                <OptionCard key={option} selected={mediaTypeChosen && mediaType === option} onClick={() => onMediaTypePick(option)}>
                  {option === 'Video' ? t.video : t.audio}
                </OptionCard>
              ))}
            </div>
          </div>
        );
      case 'format':
        return (
          <div>
            <p className={`text-sm font-bold mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.format}</p>
            {!mediaTypeChosen ? (
              <p className={`text-[0.9rem] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t.selectTypeFirst}</p>
            ) : (
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
                {formatOptionsFor(mediaType, flowAnalysis).map((format) => (
                  <OptionCard key={format} selected={selectedFormat === format} onClick={() => onFormatPick(format)}>{format}</OptionCard>
                ))}
              </div>
            )}
          </div>
        );
      case 'quality':
        return (
          <div>
            <p className={`text-sm font-bold mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.quality}</p>
            {!formatChosen ? (
              <p className={`text-[0.9rem] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t.selectFormatFirst}</p>
            ) : mediaType === 'Audio' ? (
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]">
                {qualityOptionsFor(mediaType, flowAnalysis).map((quality) => (
                  <OptionCard key={quality} selected={selectedQuality === quality} onClick={() => onQualityPick(quality)}>{quality}</OptionCard>
                ))}
              </div>
            ) : (
              <div>
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]">
                  {qualityOptionsFor(mediaType, flowAnalysis).map((quality) => (
                    <OptionCard key={quality} selected={selectedQuality === quality} onClick={() => onQualityPick(quality)}>{quality}</OptionCard>
                  ))}
                </div>
                {selectedQuality && (
                  <div className="mt-4">
                    <p className={`mb-2.5 text-xs font-bold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t.exactResolution} — {t.dimensions}</p>
                    {(() => {
                      const tiers = qualityTiersWithDimensions(flowAnalysis);
                      const selectedTier = tiers.find((t) => t.label === selectedQuality);
                      if (!selectedTier || selectedTier.dimensions.length === 0) return null;
                      if (selectedTier.dimensions.length === 1) {
                        const dim = selectedTier.dimensions[0];
                        const isQcif = dim.width === 176 && dim.height === 144;
                        return (
                          <button
                            type="button"
                            className={`rounded-xl border px-4 py-3 text-left w-full ${isDark ? 'border-sky-400 bg-sky-500/15 shadow-[0_0_0_2px_rgba(56,189,248,0.25)]' : 'border-sky-500 bg-sky-50 shadow-[0_0_0_2px_rgba(14,165,233,0.18)]'}`}
                            onClick={() => onDimensionPick(dim)}
                          >
                            <span className={`block text-sm font-bold ${isDark ? 'text-sky-100' : 'text-sky-700'}`}>{dimensionLabel(dim)}</span>
                            <span className={`block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{dim.width} × {dim.height} {isQcif ? '· QCIF 3GP' : ''}</span>
                          </button>
                        );
                      }
                      return (
                        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                          {selectedTier.dimensions.map((dimension) => {
                            const label = dimensionLabel(dimension);
                            const active = selectedDimension?.width === dimension.width && selectedDimension?.height === dimension.height;
                            const isQcif = dimension.width === 176 && dimension.height === 144;
                            return (
                              <button
                                key={label}
                                type="button"
                                onClick={() => onDimensionPick(dimension)}
                                className={`rounded-xl border px-4 py-3 text-left transition ${active ? 'border-sky-400 bg-sky-500/15 shadow-[0_0_0_2px_rgba(56,189,248,0.25)]' : (isDark ? 'border-slate-700 bg-slate-800/70 hover:border-slate-600 hover:bg-slate-800' : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50')} ${isQcif ? 'ring-1 ring-emerald-500/20' : ''}`}
                              >
                                <span className={`block text-sm font-bold ${active ? (isDark ? 'text-sky-100' : 'text-sky-700') : (isDark ? 'text-slate-200' : 'text-slate-700')}`}>{label}</span>
                                <span className={`block text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{dimension.width} × {dimension.height} {isQcif ? '· QCIF 3GP' : ''}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                    <p className="mt-2 text-xs text-slate-500">{t.qcifNote}</p>
                  </div>
                )}
              </div>
            )}
            {qualityChosen && selectedSize && (
              <div className={`mt-4 rounded-lg border p-3 ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                {selectedSize.sizeKnown && selectedSize.totalSize != null ? (
                  <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {selectedSize.videoSize != null && selectedSize.audioSize != null ? (
                      <span>{t.videoLabel}: {formatBytesForDisplay(selectedSize.videoSize)} • {t.audioLabel}: {formatBytesForDisplay(selectedSize.audioSize)} • {t.total}: {formatBytesForDisplay(selectedSize.totalSize)}</span>
                    ) : selectedSize.videoSize != null ? (
                      <span>{t.videoLabel}: {formatBytesForDisplay(selectedSize.videoSize)} • {t.total}: {formatBytesForDisplay(selectedSize.totalSize)}</span>
                    ) : selectedSize.audioSize != null ? (
                      <span>{t.audioLabel}: {formatBytesForDisplay(selectedSize.audioSize)} • {t.total}: {formatBytesForDisplay(selectedSize.totalSize)}</span>
                    ) : (
                      <span>{t.size}: {formatBytesForDisplay(selectedSize.totalSize)}</span>
                    )}
                  </div>
                ) : selectedSize.isApprox && selectedSize.totalApprox != null ? (
                  <span className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>{t.estimatedSize}: ~{formatBytesForDisplay(selectedSize.totalApprox)}</span>
                ) : (
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.size}: {t.unknownSize}</span>
                )}
              </div>
            )}
          </div>
        );
      case 'output':
        return (
          <div>
            <p className={`text-sm font-bold mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.outputFolder}</p>
            <div className="flex items-end gap-3 max-[760px]:flex-col max-[760px]:items-stretch">
              <div className="flex-1">
                <input value={outputDirectory} onChange={(e) => onOutputDirectoryChange(e.target.value)} aria-label="Output folder" className={`w-full min-w-[200px] flex-1 rounded-xl border px-4 py-[0.9rem] outline-none transition focus:border-sky-300/90 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.18)] ${isDark ? 'border-slate-400/40 bg-slate-900/80 text-slate-50' : 'border-slate-300 bg-white text-slate-800'}`} />
              </div>
              <button type="button" onClick={onBrowse} aria-label={t.browse} title={t.browse} className={`shrink-0 rounded-xl border px-5 py-[0.9rem] text-sm font-bold transition ${isDark ? 'border-slate-400/30 bg-slate-800 text-slate-200 hover:border-sky-300/40 hover:bg-slate-700 hover:text-slate-50' : 'border-slate-300 bg-white text-slate-700 hover:border-sky-300 hover:bg-slate-50'}`}>{t.browse}</button>
            </div>
            {selectedSize && (
              <div className={`mt-4 rounded-lg border p-3 ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                {selectedSize.sizeKnown && selectedSize.totalSize != null ? (
                  <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {selectedSize.videoSize != null && selectedSize.audioSize != null ? (
                      <span>{t.videoLabel}: {formatBytesForDisplay(selectedSize.videoSize)} • {t.audioLabel}: {formatBytesForDisplay(selectedSize.audioSize)} • {t.total}: {formatBytesForDisplay(selectedSize.totalSize)}</span>
                    ) : (
                      <span>{t.size}: {formatBytesForDisplay(selectedSize.totalSize)}</span>
                    )}
                  </div>
                ) : selectedSize.isApprox && selectedSize.totalApprox != null ? (
                  <span className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>{t.estimatedSize}: ~{formatBytesForDisplay(selectedSize.totalApprox)}</span>
                ) : (
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.size}: {t.unknownSize}</span>
                )}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <Panel className="min-w-0 overflow-visible">
      {/* Step chain - contained, scrollable when needed, never overflows section — py-1 prevents vertical clip of border/ring */}
      <div className="w-full min-w-0 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-1 px-2" role="navigation" aria-label="Configuration steps">
        <div className="flex items-center gap-1 min-w-max mx-auto w-fit py-1">
        {wizardSteps.map((step, idx) => {
          const completed = isStepCompleted(step);
          const isCurrent = step === wizardStep;
          const isFuture = !completed && !isCurrent;
          const canClick = completed && !isCurrent;
          const curIdx = wizardSteps.indexOf(wizardStep);
          const targetIdx = wizardSteps.indexOf(step);
          const clickable = targetIdx < curIdx;
          return (
            <div key={step} className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick(step)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold tracking-wide transition whitespace-nowrap
                  ${isCurrent ? (isDark ? 'border-sky-400 bg-sky-500/20 text-sky-100 shadow-[0_0_0_2px_rgba(56,189,248,0.28)]' : 'border-sky-500 bg-sky-100 text-sky-700 shadow-[0_0_0_2px_rgba(14,165,233,0.22)]') : ''}
                  ${!isCurrent && completed ? (isDark ? 'border-sky-400/40 bg-sky-600/15 text-sky-200 hover:bg-sky-600/20' : 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100') : ''}
                  ${isFuture ? (isDark ? 'border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-60' : 'border-slate-300 bg-slate-100 text-slate-500 cursor-not-allowed opacity-70') : ''}
                  ${canClick ? 'cursor-pointer hover:brightness-110' : ''}
                `}
                title={STEP_LABELS[step]}
              >
                {completed && !isCurrent ? (
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white text-[10px] leading-none">✓</span>
                ) : isCurrent ? (
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-400 text-slate-900 text-[10px] font-black">•</span>
                ) : (
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-600 text-[10px] text-slate-500">{idx + 1}</span>
                )}
                {STEP_LABELS[step]}
              </button>
              {idx < wizardSteps.length - 1 && (
                <span className={`mx-1 h-0.5 w-6 shrink-0 rounded ${wizardSteps.slice(0, idx + 1).every((s) => isStepCompleted(s)) ? 'bg-sky-500/50' : (isDark ? 'bg-slate-700' : 'bg-slate-300')}`} aria-hidden="true" />
              )}
            </div>
          );
        })}
        </div>
      </div>

      <div className={`mt-4 rounded-xl border p-4 min-h-[140px] ${isDark ? 'border-slate-700/30 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
        {renderStepContent()}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div>
          {!isFirstStep ? (
            <button type="button" onClick={onWizardBack} className={`rounded-xl border px-5 py-2.5 text-sm font-bold transition ${isDark ? 'border-slate-400/30 bg-slate-800 text-slate-200 hover:border-sky-300/40 hover:bg-slate-700' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'}`}>{t.back}</button>
          ) : <span />}
        </div>
        <div className="flex items-center gap-2">
          {queueCount > 0 && onGoToQueue && (
            <button type="button" onClick={onGoToQueue} className={`rounded-xl border px-5 py-2.5 text-sm font-bold transition ${isDark ? 'border-sky-400/40 bg-slate-800 text-sky-300 hover:border-sky-400 hover:bg-sky-500/10 hover:text-sky-100' : 'border-sky-300 bg-sky-50 text-sky-700 hover:border-sky-400 hover:bg-sky-100'}`}>{t.goToQueue}</button>
          )}
          {isLastStep ? (
            <button type="button" onClick={onAddToQueue} aria-disabled={!canAdd} className={`rounded-xl px-5 py-2.5 text-sm font-bold transition border ${!canAdd ? (isDark ? 'bg-slate-700 text-slate-400 border-slate-600 opacity-90' : 'bg-slate-200 text-slate-500 border-slate-300 opacity-90') : 'bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)] text-white border-transparent hover:-translate-y-px shadow'}`}>{t.addToQueue}</button>
          ) : (
            <button type="button" onClick={onWizardNext} disabled={!canProceedCurrent} className={`rounded-xl px-5 py-2.5 text-sm font-bold transition border ${!canProceedCurrent ? (isDark ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60 border-slate-600' : 'bg-slate-200 text-slate-500 cursor-not-allowed opacity-70 border-slate-300') : 'bg-sky-500 text-white hover:bg-sky-400 border-sky-400/30 shadow'}`}>{t.next}</button>
          )}
        </div>
      </div>

      {error && <p className="mt-3.5 text-[0.95rem] text-red-300">{error}</p>}
    </Panel>
  );
};
