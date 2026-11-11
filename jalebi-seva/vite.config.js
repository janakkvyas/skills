import { defineConfig } from 'vite';

// Relative base so the same build runs from a web server, from the Android
// WebView asset host, or from any sub-folder.
export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
    chunkSizeWarningLimit: 1500,
  },
});
