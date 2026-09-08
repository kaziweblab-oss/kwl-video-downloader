#!/bin/bash
set -e
echo "[windows] Building KWL Video Downloader for Windows (NSIS + MSI) ..."
npm run build --workspace @kwl/desktop
npx tauri build --bundles nsis msi --config apps/desktop/src-tauri/tauri.conf.json || {
  echo "[windows] Bundle built at apps/desktop/src-tauri/target/release/bundle (signing skipped if TAURI_SIGNING_PRIVATE_KEY missing)"
}
echo "[windows] Done"
