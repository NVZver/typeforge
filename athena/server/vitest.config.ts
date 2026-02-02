import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@typeforge/types': path.resolve(__dirname, '../types'),
    },
  },
  test: {
    globals: true,
  },
});
