import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
export default defineConfig({
  // GitHub Pages project site: https://<user>.github.io/earth-pulse/
  base: '/earth-pulse/',
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
});
