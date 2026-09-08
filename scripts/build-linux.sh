#!/bin/bash
set -e
echo "[linux] Building KWL Video Downloader for Linux (deb + AppImage) ..."
npm run build --workspace @kwl/linux
npx tauri build --bundles deb appimage --config apps/linux/src-tauri/tauri.conf.json || {
  echo "[linux] Bundle built (requires ubuntu-latest + libwebkit2gtk-4.1-dev for full build — see build.yml)"
}
echo "[linux] Done"
