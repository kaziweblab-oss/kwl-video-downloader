import { UrlPanel } from './UrlPanel';
import { AnalyzedMediaList } from './AnalyzedMediaList';
import { Configuration } from './Configuration';
import { isAnalyzableUrl, type FlowAnalysis, type FlowResolution, type SelectedSize, type WizardStepId } from '../downloadFlow';
import type { AnalysisState } from '../downloadFlow';

export interface DownloaderViewProps {
  url: string;
  onUrlChange: (url: string) => void;
  onPaste: () => void;
  onAnalyze: () => void;
  onClear: () => void;
  isLoading: boolean;
  status: string;
  error: string | null;
  analyses: AnalysisState[];
  selectedMediaIds: string[];
  activeMediaId: string | null;
  onMediaCardSelect: (analysisId: string) => void;
  onRemoveAnalysis: (analysisId: string) => void;
  onRemoveSelection: () => void;
  onMarkAll?: () => void;
  onUnmarkAll?: () => void;
  onClearAll?: () => void;
  mediaType: 'Video' | 'Audio';
  mediaTypeChosen: boolean;
  selectedFormat: string;
  formatChosen: boolean;
  selectedQuality: string;
  qualityChosen: boolean;
  selectedDimension: FlowResolution | null;
  onMediaTypePick: (type: 'Video' | 'Audio') => void;
  onFormatPick: (format: string) => void;
  onQualityPick: (quality: string) => void;
  onDimensionPick: (dimension: FlowResolution) => void;
  outputDirectory: string;
  onOutputDirectoryChange: (dir: string) => void;
  onBrowse: () => void;
  onAddToQueue: () => void;
  canAdd: boolean;
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

export const DownloaderView = ({
  url,
  onUrlChange,
  onPaste,
  onAnalyze,
  onClear,
  isLoading,
  status,
  error,
  analyses,
  selectedMediaIds,
  activeMediaId,
  onMediaCardSelect,
  onRemoveAnalysis,
  onRemoveSelection,
  onMarkAll,
  onUnmarkAll,
  onClearAll,
  mediaType,
  mediaTypeChosen,
  selectedFormat,
  formatChosen,
  selectedQuality,
  qualityChosen,
  selectedDimension,
  onMediaTypePick,
  onFormatPick,
  onQualityPick,
  onDimensionPick,
  outputDirectory,
  onOutputDirectoryChange,
  onBrowse,
  onAddToQueue,
  canAdd,
  flowAnalysis,
  wizardStep,
  wizardSteps,
  onWizardNext,
  onWizardBack,
  onStepClick,
  queueCount = 0,
  onGoToQueue,
  selectedSize,
}: DownloaderViewProps) => {
  const analyzeEnabled = isAnalyzableUrl(url) && !isLoading;
  const activeMediaCount = selectedMediaIds.length;
  const mediaSelected = activeMediaCount > 0;

  return (
    <>
      <UrlPanel
        url={url}
        onUrlChange={onUrlChange}
        onPaste={onPaste}
        onAnalyze={onAnalyze}
        onClear={onClear}
        isLoading={isLoading}
        analyzeEnabled={analyzeEnabled}
        status={status}
        error={error}
      />

      <section className="mt-5">
        <AnalyzedMediaList
          analyses={analyses}
          selectedMediaIds={selectedMediaIds}
          activeMediaId={activeMediaId}
          onMediaCardSelect={onMediaCardSelect}
          onRemoveAnalysis={onRemoveAnalysis}
          onRemoveSelection={onRemoveSelection}
          onMarkAll={onMarkAll}
          onUnmarkAll={onUnmarkAll}
          onClearAll={onClearAll}
          activeMediaCount={activeMediaCount}
        />
      </section>

      <div className="mt-6">
        <Configuration
          mediaSelected={mediaSelected}
          mediaType={mediaType}
          mediaTypeChosen={mediaTypeChosen}
          selectedFormat={selectedFormat}
          formatChosen={formatChosen}
          selectedQuality={selectedQuality}
          qualityChosen={qualityChosen}
          selectedDimension={selectedDimension}
          outputDirectory={outputDirectory}
          onMediaTypePick={onMediaTypePick}
          onFormatPick={onFormatPick}
          onQualityPick={onQualityPick}
          onDimensionPick={onDimensionPick}
          onOutputDirectoryChange={onOutputDirectoryChange}
          onBrowse={onBrowse}
          onAddToQueue={onAddToQueue}
          canAdd={canAdd}
          error={error}
          flowAnalysis={flowAnalysis}
          wizardStep={wizardStep}
          wizardSteps={wizardSteps}
          onWizardNext={onWizardNext}
          onWizardBack={onWizardBack}
          onStepClick={onStepClick}
          queueCount={queueCount}
          onGoToQueue={onGoToQueue}
          selectedSize={selectedSize}
        />
      </div>
    </>
  );
};