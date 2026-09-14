import { defineConfig } from 'vite';
import { qwenLocalPlugin } from './scripts/qwen/vite-plugin.mjs';

export default defineConfig({
  plugins: [qwenLocalPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    open: false,
    proxy: {
      '/qwen': {
        target: 'http://127.0.0.1:8721',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/qwen/, ''),
      },
    },
  },
  preview: {
    proxy: {
      '/qwen': {
        target: 'http://127.0.0.1:8721',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/qwen/, ''),
      },
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
});
