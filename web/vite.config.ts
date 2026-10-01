import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
  build: { rollupOptions: { output: { manualChunks: (id: string) => (id.includes('node_modules') ? (/recharts|d3-|victory|decimal|eventemitter|immer|reselect|redux|es-toolkit/.test(id) ? 'charts' : /react|scheduler|router/.test(id) ? 'vendor' : undefined) : undefined) } } },
});
