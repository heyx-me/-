import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['{rafi,nanie}/**/*.{test,spec}.{js,jsx}'],
    exclude: ['tests/e2e/**', '**/node_modules/**'],
    globals: true,
    alias: {
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
  },
});
