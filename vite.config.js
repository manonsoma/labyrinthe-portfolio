import { defineConfig } from 'vite';

// base: './' → le site fonctionne quelle que soit l'adresse (GitHub Pages compris)
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  server: { host: true },
});
