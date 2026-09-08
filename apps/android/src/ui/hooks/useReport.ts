import { useCallback, useState } from 'react';
import { getAppInfo, sendReport, type ReportInput } from '../../native/tauriBridge';

export type ReportType = 'error' | 'suggestion' | 'feedback';

type ReportOptions = {
  includeInfo?: boolean;
  email?: string;
};

function collectDiagnosticInfo(): string {
  const lines: string[] = [];
  try {
    const raw = localStorage.getItem('kwl:settings');
    if (raw) {
      const parsed = JSON.parse(raw) as { language?: string; maxConcurrent?: number };
      lines.push(`Language: ${parsed.language ?? 'en'}`);
      lines.push(`Max concurrent: ${parsed.maxConcurrent ?? 2}`);
    }
  } catch {}
  return lines.join('\n');
}

export function useReport() {
  const [sending, setSending] = useState(false);

  const send = useCallback(async (type: ReportType, message: string, opts: ReportOptions = {}) => {
    setSending(true);
    try {
      let logs: string | undefined;
      if (opts.includeInfo) {
        let appLine = 'KWL Video Downloader (browser preview)';
        try {
          const info = await getAppInfo();
          appLine = `${info.name} v${info.version} (${info.platform}, ${info.environment})`;
        } catch {}
        logs = `${appLine}\n${collectDiagnosticInfo()}`;
      }
      const payload: ReportInput = {
        report_type: type,
        message: message.trim(),
        email: opts.email?.trim() ? opts.email.trim() : null,
        logs,
      };
      await sendReport(payload);
    } finally {
      setSending(false);
    }
  }, []);

  return { send, sending };
}