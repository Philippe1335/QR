import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // En dev, l'API Express tourne à côté (npm run dev:server).
    proxy: { '/api': 'http://localhost:3000' }
  }
});
