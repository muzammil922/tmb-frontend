import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

function urduboxDevProxy(): Plugin {
  return {
    name: 'urdubox-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/urdubox', async (req, res) => {
        try {
          const requestUrl = new URL(req.url || '', 'http://localhost');
          const target = requestUrl.searchParams.get('url');
          if (!target?.startsWith('https://urdubox.pk/')) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid url' }));
            return;
          }

          const response = await fetch(target, {
            headers: {
              Accept: 'application/json',
              Referer: 'https://urdubox.pk/',
              Origin: 'https://urdubox.pk',
            },
          });

          res.statusCode = response.status;
          res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
          res.end(await response.text());
        } catch (error: any) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: error?.message || 'Proxy failed' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), urduboxDevProxy()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173 },
});
