import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Main build: the two extension pages (React) + the background service worker.
// `npm run build` runs this first, then vite.content.config.js bundles the
// content script (content scripts can't be ES modules, so it builds separately
// as a classic IIFE).
export default defineConfig({
  // Relative base: extension pages resolve assets under chrome-extension://<id>/
  base: './',
  plugins: [react(), tailwindcss()],
  input: {
    panel: resolve(import.meta.dirname, 'panel.html'),
    options: resolve(import.meta.dirname, 'options.html'),
    background: resolve(import.meta.dirname, 'src/background.js'),
  },
  build: {
    outDir: 'dist',
    rolldownOptions: {
      output: {
        // Stable filename for the worker (the manifest points at it); page
        // chunks stay hashed under assets/ (web_accessible_resources: assets/*).
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
