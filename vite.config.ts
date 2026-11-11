import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// The site is several plain HTML pages; Vite bundles their scripts (src/) and copies public/ (models, textures, data, style.css) as is
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    rollupOptions: {
      input: Object.fromEntries(['index', 'writeups/pacmap', 'writeups/tailscale-failover', 'writeups/deauth-wazuh'].map(p => [p, path.resolve(__dirname, `${p}.html`)])),
    },
  },
});
