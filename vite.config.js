import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    // hashed bundles live apart from the unhashed media in public/assets, so each can be cached differently
    assetsDir: 'bundle',
    chunkSizeWarningLimit: 1200,
  },
});
