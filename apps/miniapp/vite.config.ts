import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // В dev API живёт на :3000 — Mini App ходит на относительный /api
    proxy: { '/api': 'http://localhost:3000' },
  },
});
