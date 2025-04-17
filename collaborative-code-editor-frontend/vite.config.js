import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    'global': 'window',  // Use window as global for browser environment
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
});