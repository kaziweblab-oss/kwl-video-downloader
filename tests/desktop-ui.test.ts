import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { App, getCartItemStatus } from '../apps/desktop/src/ui/App';
import { DownloaderView, type DownloaderViewProps } from '../apps/desktop/src/ui/components/DownloaderView';
import { QueueView } from '../apps/desktop/src/ui/views/QueueView';
import { HistoryView } from '../apps/desktop/src/ui/views/HistoryView';
import { TranslationProvider } from '../apps/desktop/src/ui/hooks/useTranslations';

function renderAppMarkup(): string {
  return renderToString(createElement(App));
}

function renderDownloaderView(overrides: Partial<DownloaderViewProps> = {}): string {
  const props: DownloaderViewProps = {
    url: 'https://example.com/video',
    onUrlChange: () => {},
    onPaste: () => {},
    onAnalyze: () => {},
    onClear: () => {},
    isLoading: false,
    status: 'Ready',
    error: null,
    analyses: [],
    selectedMediaIds: [],
    activeMediaId: null,
    onMediaCardSelect: () => {},
    onRemoveAnalysis: () => {},
    onRemoveSelection: () => {},
    mediaType: 'Video',
    mediaTypeChosen: false,
    selectedFormat: '',
    formatChosen: false,
    selectedQuality: '',
    qualityChosen: false,
    selectedDimension: null,
    onMediaTypePick: () => {},
    onFormatPick: () => {},
    onQualityPick: () => {},
    onDimensionPick: () => {},
    outputDirectory: 'C:\\Users\\Downloads\\KWL Video Downloader',
    onOutputDirectoryChange: () => {},
    onBrowse: () => {},
    onAddToQueue: () => {},
    canAdd: false,
    flowAnalysis: null,
    wizardStep: 'media',
    wizardSteps: ['media','type','format','quality','output'],
    onWizardNext: () => {},
    onWizardBack: () => {},
    onStepClick: () => {},
    ...overrides,
  };
  return renderToString(
    createElement(TranslationProvider, null, createElement(DownloaderView, props))
  );
}

function renderQueueView(): string {
  return renderToString(
    createElement(TranslationProvider, null, createElement(QueueView))
  );
}

function renderHistoryView(): string {
  return renderToString(
    createElement(TranslationProvider, null, createElement(HistoryView))
  );
}

describe('desktop app shell', () => {
  it('renders the analyzed media list, download queue cart, and wizard', () => {
    const markup = renderAppMarkup();

    expect(markup).toContain('Analyzed media');
    expect(markup).toContain('Analyze a link to build the media list.');
    // wizard shows MEDIA as first step and Next button
    expect(markup).toContain('MEDIA');
    expect(markup).toContain('Next');
  });

  it('renders the queue view', () => {
    const markup = renderQueueView();

    expect(markup).toContain('Download pending');
    expect(markup).toContain('Added downloads will appear here.');
  });

  it('renders the history view', () => {
    const markup = renderHistoryView();

    expect(markup).toContain('Recent downloads');
    expect(markup).toContain('Completed downloads will appear here.');
  });
});

describe('strict sequential download flow', () => {
  it('does not auto-select media and shows wizard MEDIA as current with Next disabled', () => {
    const markup = renderDownloaderView();

    // No format/quality buttons visible on MEDIA step
    expect(markup).not.toMatch(/<button[^>]*>MP4<\/button>/);
    expect(markup).not.toMatch(/<button[^>]*>1080p<\/button>/);
    expect(markup).toContain('MEDIA');
    // Next disabled until media selected (has disabled attribute)
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Next/);
    expect(markup).not.toContain('>Media preview</h3>');
  });

  it('keeps the analyze button enabled for a valid url and shows the empty analyzed media', () => {
    const markup = renderDownloaderView();

    expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*>Analyze<\/button>/);
    expect(markup).toContain('Analyze a link to build the media list.');
  });

  it('renders the url input and horizontal wizard step chain', () => {
    const markup = renderDownloaderView();

    expect(markup).toContain('placeholder="https://example.com/video"');
    expect(markup).not.toContain('>Media preview</h3>');
    expect(markup).toContain('Analyzed media');
    expect(markup).toContain('TYPE');
    expect(markup).toContain('FORMAT');
    expect(markup).toContain('QUALITY');
    expect(markup).toContain('OUTPUT');
  });

  it('hides Resolution step for Audio flow', () => {
    const markup = renderDownloaderView({ wizardSteps: ['media','type','format','quality','output'], mediaType: 'Audio', mediaTypeChosen: true });
    expect(markup).not.toContain('RESOLUTION');
    expect(markup).toContain('OUTPUT');
  });

  it('shows only current step controls - format step shows format options', () => {
    const analysis = { id: 'a1', sourceUrl: 'https://example.com/video', title: 'T', author: 'A', duration: '1m', available: true, videoFormats: ['MP4','WEBM'], audioFormats: ['MP3'], videoResolutions: [{label:'1080p', width:1920, height:1080}], audioQualities: ['Best'], formats: [], supports3gp: false } as any;
    const markup = renderDownloaderView({ wizardStep: 'format', mediaTypeChosen: true, flowAnalysis: analysis });
    expect(markup).toContain('MP4');
    expect(markup).not.toContain('Select Media');
  });

  it('does not render FPS anywhere in wizard', () => {
    const markup = renderDownloaderView();
    expect(markup).not.toMatch(/FPS/i);
  });
});

describe('cart job status mapping', () => {
  it('maps the native paused status without treating it as cancelled', () => {
    expect(getCartItemStatus('paused')).toBe('Paused');
    expect(getCartItemStatus('paused')).not.toBe('Cancelled');
  });

  it('maps the full download lifecycle statuses', () => {
    expect(getCartItemStatus('queued')).toBe('Queued');
    expect(getCartItemStatus('downloading')).toBe('Downloading');
    expect(getCartItemStatus('processing')).toBe('Processing');
    expect(getCartItemStatus('validating')).toBe('Validating');
    expect(getCartItemStatus('completed')).toBe('Completed');
    expect(getCartItemStatus('cancelled')).toBe('Cancelled');
  });

  it('maps unknown statuses to failed', () => {
    expect(getCartItemStatus('bogus')).toBe('Failed');
  });
});