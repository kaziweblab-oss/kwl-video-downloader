import { Panel } from '../components/Panel';
import { getAppShellState } from '../../app';

export const AboutView = () => {
  const shell = getAppShellState();

  return (
    <Panel padding="lg">
      <div className="grid justify-items-center gap-4 text-center">
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl border-2 border-kwl-brand-blue bg-kwl-brand-blue/10">
          <span className="text-2xl font-bold text-kwl-brand-sky">KWL</span>
        </div>
        <div>
          <h2 className="m-0 text-2xl font-bold tracking-tight">KWL Video Downloader</h2>
          <p className="mt-1 text-slate-400">Version {shell.version}</p>
          <p className="mt-1 text-slate-500">Windows x64</p>
        </div>

        <p className="max-w-md text-slate-300">
          A modern video downloader built with Tauri 2, React, TypeScript, and Rust.
          Supports multi-format downloads, real-time progress, pause/resume, and history management.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="border-slate-400/30 bg-slate-800/90 px-[1.2rem] py-[0.9rem] text-slate-50 rounded-xl border border-transparent font-bold transition hover:-translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 max-[760px]:w-full max-[760px]:px-4 max-[760px]:py-[0.78rem]"
          >
            GitHub
          </button>
          <button
            type="button"
            className="border-slate-400/30 bg-slate-800/90 px-[1.2rem] py-[0.9rem] text-slate-50 rounded-xl border border-transparent font-bold transition hover:-translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 max-[760px]:w-full max-[760px]:px-4 max-[760px]:py-[0.78rem]"
          >
            Report Issue
          </button>
        </div>

        <p className="text-xs text-slate-500">© 2026 KWL. All rights reserved.</p>
      </div>
    </Panel>
  );
};