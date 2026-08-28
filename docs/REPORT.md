# In-app Report System

KWL Video Downloader includes a built-in report center so users can report an
error, send a suggestion, or give feedback without leaving the app.

## Where to find it

**Settings → "📧 Report Issue / Suggestion"** (footer button of the Settings page).

## How it works

1. The user picks a report type (**Error**, **Suggestion**, or **Feedback**),
   writes a message (required), can tick **"Attach diagnostic info"** (app
   version, platform, and settings), and can optionally add an email address.
2. The frontend sends the report through the `send_report` Tauri command
   (`src-tauri/src/report.rs`).
3. If email is configured, the report is posted as an email (Resend-style HTTP
   API). Otherwise, or if sending fails, the report is written to a local queue
   file `reports.json` (in the app data directory, capped at 200 entries).
4. On the next app launch, `flush_pending_reports` retries any queued reports
   before the main window appears.

From the user's perspective a report always "succeeds": it is either emailed
right away or queued for delivery later.

## Configuration

The system reads these environment variables (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `REPORT_EMAIL_TO` | Recipient address that receives the reports (e.g. `support@kwl.com`) |
| `REPORT_EMAIL_FROM` | Sender address (e.g. `noreply@kwl.com`) |
| `REPORT_EMAIL_API_KEY` | Resend (`https://api.resend.com`) API key (`re_...`) |

When `REPORT_EMAIL_API_KEY` is missing or blank, reports always fall back to the
local queue — the app itself still works normally.

## Implementation notes

- Backend: `apps/desktop/src-tauri/src/report.rs` — validation, email delivery,
  local queue with truncation at 200 entries, and a startup flush.
- Frontend: `ui/hooks/useReport.ts` (send logic + diagnostic info), `ui/components/ReportModal.tsx`
  and `ui/components/ReportButton.tsx`.
- In the browser (Vite dev without Tauri) `sendReport` is a no-op stub so the
  UI can be previewed.
- Tests: `cargo test report` covers validation, date formatting, local fallback
  behavior, the queue cap, and the flush logic (isolated via `KWL_REPORTS_DIR`).