// @kwl/core - Shared Rust core re-export (TypeScript facade)
// Real Rust core lives in apps/desktop/src-tauri/src/lib.rs and packages/downloader-core
// This package provides shared constants for all platforms
export const APP_NAME = "KWL Video Downloader";
export const APP_VERSION = "1.0.3";
export const IDENTIFIER = "com.kwl.videodownloader";
export * from "@kwl/shared";
