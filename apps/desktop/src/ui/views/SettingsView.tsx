import { useState } from 'react';
import { Panel, PanelHeader } from '../components/Panel';
import { ReportButton } from '../components/ReportButton';
import { useTranslations, useLanguage } from '../hooks/useTranslations';
import { useSettings } from '../store/settingsStore';

export const SettingsView = () => {
  const t = useTranslations();
  const { language, setLanguage } = useLanguage();
  const { settings, setMaxConcurrent } = useSettings();
  const [concurrentModalOpen, setConcurrentModalOpen] = useState(false);

  return (
    <div className="space-y-5">

      <Panel>
        <PanelHeader label="General" count={null} compact>
          <h3 className="m-0 text-lg font-bold tracking-tight">General</h3>
        </PanelHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-2.5 block font-bold text-slate-300">{t.defaultOutputFolder}</label>
            <div className="flex items-end gap-3 max-[760px]:flex-col max-[760px]:items-stretch">
              <input
                type="text"
                value="C:\\Users\\Public\\Videos\\KWL Downloads"
                readOnly
                className="w-full min-w-[200px] flex-1 rounded-xl border border-slate-400/40 bg-slate-900/80 px-4 py-[0.9rem] text-slate-50 outline-none transition focus:border-sky-300/90 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.18)]"
              />
            </div>
          </div>

          <div>
            <label className="mb-2.5 block font-bold text-slate-300">Language</label>
            <div className="inline-flex rounded-[10px] border border-slate-400/25 bg-slate-900/70 p-1">
              <button
                type="button"
                className={language === 'en' ? 'rounded-lg bg-sky-400/20 px-[0.7rem] py-[0.4rem] font-bold text-sky-100' : 'rounded-lg px-[0.7rem] py-[0.4rem] font-bold text-slate-300'}
                onClick={() => setLanguage('en')}
              >
                EN
              </button>
              <button
                type="button"
                className={language === 'bn' ? 'rounded-lg bg-sky-400/20 px-[0.7rem] py-[0.4rem] font-bold text-sky-100' : 'rounded-lg px-[0.7rem] py-[0.4rem] font-bold text-slate-300'}
                onClick={() => setLanguage('bn')}
              >
                BN
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2.5 block font-bold text-slate-300">{t.theme}</label>
            <p className="text-[0.95rem] text-slate-400">{t.darkTheme}</p>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader label="Advanced" count={null} compact>
          <h3 className="m-0 text-lg font-bold tracking-tight">Advanced</h3>
        </PanelHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-2.5 block font-bold text-slate-300">{t.maxConcurrentLabel}</label>
            <button
              type="button"
              onClick={() => setConcurrentModalOpen(true)}
              className="flex w-full max-w-[320px] items-center justify-between rounded-xl border border-slate-400/30 bg-slate-900/80 px-4 py-3 text-left text-slate-200 transition hover:border-sky-300/50 hover:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-sky-300/50"
            >
              <span className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 border border-sky-400/20">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <span className="text-sm font-bold text-slate-100">{settings.maxConcurrent} video{settings.maxConcurrent > 1 ? 's' : ''} at once</span>
                <span className="ml-1 text-xs text-slate-400">· Professional</span>
              </span>
              <span className="text-slate-400">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M8 9l4 4 4-4" /><path d="M16 15l-4-4-4 4" /></svg>
              </span>
            </button>
            <p className="mt-1.5 text-[0.72rem] text-slate-500">{t.maxConcurrentHint}</p>
            {concurrentModalOpen && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[6px]" onClick={() => setConcurrentModalOpen(false)} aria-hidden="true" />
                <div className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900 shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-100">{t.concurrentDownloadsTitle}</h3>
                      <p className="mt-1 text-xs text-slate-400">{t.concurrentDownloadsDesc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConcurrentModalOpen(false)}
                      className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition"
                      aria-label="Close"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="p-5 grid gap-2.5 grid-cols-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => { setMaxConcurrent(n); setConcurrentModalOpen(false); }}
                        className={`rounded-xl border px-4 py-3 text-left transition ${settings.maxConcurrent === n ? 'border-sky-400 bg-sky-500/15 text-sky-100 shadow-[0_0_0_2px_rgba(56,189,248,0.25)]' : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:border-slate-600 hover:bg-slate-800'}`}
                      >
                        <span className="block text-base font-bold">{n} video{n > 1 ? 's' : ''}</span>
                        <span className="block text-xs text-slate-400">{n === 1 ? t.sequential : n === 2 ? t.defaultConcurrent : n === 3 ? t.recommended : n === 5 ? t.maxConcurrent : `${n} parallel`}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/80 px-5 py-3">
                    <span className="text-xs text-slate-500">{t.currentConcurrent.replace('{count}', settings.maxConcurrent.toString())}</span>
                    <button
                      type="button"
                      onClick={() => setConcurrentModalOpen(false)}
                      className="rounded-xl bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)] px-5 py-2 text-sm font-bold text-slate-50 shadow hover:-translate-y-px transition"
                    >
                      {t.done}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader label="Updates" count={null} compact>
          <h3 className="m-0 text-lg font-bold tracking-tight">Updates</h3>
        </PanelHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-2.5 block font-bold text-slate-300">{t.checkUpdates}</label>
            <button
              type="button"
              className="bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)] px-[1.2rem] py-[0.9rem] text-slate-50 rounded-xl border border-transparent font-bold transition hover:-translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 max-[760px]:w-full max-[760px]:px-4 max-[760px]:py-[0.78rem]"
            >
              {t.checkNow}
            </button>
          </div>
        </div>
      </Panel>

      <div className="flex justify-end pt-1">
        <ReportButton />
      </div>
    </div>
  );
};
