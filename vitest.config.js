import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['rafi/**/*.{test,spec}.{js,jsx}'],
    exclude: ['tests/e2e/**', '**/node_modules/**'],
    globals: true,
  },
});
