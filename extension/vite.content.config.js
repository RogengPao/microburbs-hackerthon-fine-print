import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Content script build: bundled as a classic IIFE — content scripts can't be
// ES modules. Runs AFTER the main build, so emptyOutDir stays off or it would
// wipe dist/. The output path must match manifest.content_scripts.js.
export default defineConfig({
  publicDir: false, // don't copy public/ (manifest) into the content outDir
  build: {
    outDir: 'dist/content',
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/content/inject.js'),
      name: 'FinePrintContent',
      formats: ['iife'],
      fileName: () => 'inject.js',
    },
  },
});
