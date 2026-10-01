import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Migrated from deprecated `esbuild` to `oxc` for Vite 8+ (rolldown).
  // `@vitejs/plugin-react` still sets `esbuild`/`optimizeDeps.esbuildOptions` internally
  // until upstream updates — warnings from that plugin are harmless and do not break the build.
  // Our config uses the new `oxc` and `optimizeDeps.rolldownOptions` keys.
  oxc: {},
  build: {
    // Downlevel syntax (no `?.`/`??` in output) so old system WebViews
    // (e.g. Chrome 69 on frozen emulator images) can still parse the bundle.
    // No modern runtime APIs are used anywhere (audited), so no polyfills needed.
    target: 'es2019',
  },
  optimizeDeps: {
    // rolldown replaces esbuild for dep optimization in Vite 8+
    rolldownOptions: {},
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    watch: {
      ignored: ['**/src-tauri/**']
    }
  }
});
