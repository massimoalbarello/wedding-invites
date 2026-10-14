import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  build: {
    outDir: fileURLToPath(new URL('../web/dist/invitations/pastel-garden', import.meta.url)),
    emptyOutDir: true,
  },
  plugins: [react()],
});
