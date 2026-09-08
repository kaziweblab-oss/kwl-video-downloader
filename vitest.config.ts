import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Use forks pool to avoid "Worker exited unexpectedly" on Windows
    // (threads can be unstable with native modules / large transforms).
    pool: 'forks',
    forks: {
      singleFork: true,
    },
    // Deterministic single-threaded execution for CI
    sequence: { concurrent: false },
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
