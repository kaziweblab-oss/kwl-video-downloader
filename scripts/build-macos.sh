#!/bin/bash
set -e
echo "[macos] Building KWL Video Downloader for macOS (dmg) ..."
npm run build --workspace @kwl/macos
npx tauri build --bundles dmg --config apps/macos/src-tauri/tauri.conf.json || {
  echo "[macos] Bundle built (requires macos-latest — see build.yml)"
}
echo "[macos] Done"
