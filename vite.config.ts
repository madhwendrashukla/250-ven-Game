import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The leaderboard API runs separately in dev (npm run dev starts both). API_PORT points it elsewhere.
    proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 8787}` },
  },
});
