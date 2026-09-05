import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'server/**/*.ts'],
      exclude: [
        'server/**/*.test.ts',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/test/**',
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/app/**',
        'src/features/**/index.ts',
      ],
      thresholds: {
        lines: 80,
      },
    },
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'server/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
