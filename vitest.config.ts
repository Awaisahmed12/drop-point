import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    // utils/ at the repo root holds pure-function helpers re-exported through
    // src/utils/formatting.ts; tests for them live colocated rather than
    // forced into src/.
    include: ['src/**/*.test.{ts,tsx}', 'utils/**/*.test.{ts,tsx}'],
  },
}); 