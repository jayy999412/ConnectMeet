import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Proxy API calls to the local Flask backend during development so the
    // browser only ever talks to a single origin (no CORS issues locally).
    // 127.0.0.1 (IPv4) is used explicitly because `localhost` may resolve to
    // ::1 on Windows while Flask binds IPv4 only.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
});
