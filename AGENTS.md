# KWL Video Downloader Agent Instructions

## Start here

Every coding agent must read this file first, then read `docs/MEMORY.md`, `docs/MASTER-SPEC.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT-STATE.md`, and `docs/DECISION-LOG.md`. Inspect the actual repository, package files, tests, and current implementation before editing.

## Working rules

- Continue the existing project. Never restart it or create a second application.
- Preserve the locked Tauri 2 + React + TypeScript + Vite + Rust architecture.
- Keep process execution in Rust behind typed Tauri commands; the frontend must not execute shell commands.
- Do not delete working functionality or introduce production mocks.
- Continue from `CURRENT TASK` in `docs/PROJECT-STATE.md`.
- Implement incrementally and validate every meaningful change with tests, typecheck, build, and real runtime checks when available.
- Report only `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`; never fabricate verification.
- Update `docs/PROJECT-STATE.md` before ending meaningful work.
- Update `docs/MEMORY.md` at the end of every meaningful session: move the previous entry into "Earlier sessions", record what was done, the current focus, gotchas, and the resume checklist.
- Update `docs/DECISION-LOG.md` for architectural decisions.
- Keep ordinary CI deterministic and independent of third-party websites.
- Do not ask the user for another phase prompt when the next phase is already defined in `MASTER-SPEC.md` and `ROADMAP.md`.
- After a phase gate genuinely passes, continue automatically to the next roadmap phase.
- Stop only when the roadmap is complete or a genuine blocker requires human intervention, such as missing credentials, signing certificates, external services, or required toolchains.

## Validation discipline

Use the repository's real commands where possible. Native claims require Cargo/Rust verification. Installer, release, license, Nexus, and update claims require fresh executable evidence. Keep blocked work explicitly documented and do not mark a phase complete until its acceptance gate passes.
