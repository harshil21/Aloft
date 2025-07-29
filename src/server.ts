// src/server.ts
import { serve } from 'bun';
import { join } from 'path';

const PORT = process.env.PORT || 3000;
const DIST_DIR = './dist';

serve({
  port: Number(PORT),
  async fetch(req) {
    const url = new URL(req.url);
    let filePath = join(DIST_DIR, url.pathname === '/' ? 'index.html' : url.pathname);

    // Default to index.html for SPA-style routing
    try {
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        filePath = join(DIST_DIR, 'index.html');
      }

      const response = new Response(Bun.file(filePath));
      // Set content type based on file extension
      if (filePath.endsWith('.html')) {
        response.headers.set('Content-Type', 'text/html');
      } else if (filePath.endsWith('.css')) {
        response.headers.set('Content-Type', 'text/css');
      } else if (filePath.endsWith('.js')) {
        response.headers.set('Content-Type', 'application/javascript');
      }
      return response;
    } catch (e) {
      return new Response('File not found', { status: 404 });
    }
  },
  error(error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});

console.log(`Serving at http://localhost:${PORT}`);