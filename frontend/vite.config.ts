import { defineConfig } from 'vite';

// Proxy /api vers le backend HTTPS (certificat auto-signé accepté)
export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://localhost:4443',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
