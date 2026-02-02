import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte({ hot: false })],
  resolve: {
    alias: {
      '@typeforge/types': path.resolve(__dirname, '../types'),
    },
  },
  test: {
    globals: true,
    passWithNoTests: true,
  },
});
