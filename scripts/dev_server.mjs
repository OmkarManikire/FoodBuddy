import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve('public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdn.tailwindcss.com https://unpkg.com https://cdnjs.cloudflare.com https://accounts.google.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://*.googleapis.com; frame-src 'self' https://accounts.google.com; worker-src 'self' blob:;",
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Rewrites matching vercel.json
  if (pathname === '/otp' || pathname === '/otp/') {
    pathname = '/verify-otp.html';
  }

  // If directory, try index.html
  if (pathname.endsWith('/')) {
    pathname += 'index.html';
  } else if (!path.extname(pathname)) {
    // If no extension and exists as directory, append /index.html
    const potentialDir = path.join(PUBLIC_DIR, pathname);
    if (fs.existsSync(potentialDir) && fs.statSync(potentialDir).isDirectory()) {
      pathname += '/index.html';
    } else if (fs.existsSync(potentialDir + '.html')) {
      pathname += '.html';
    }
  }

  const filePath = path.join(PUBLIC_DIR, pathname);

  // Security check: ensure path is within PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const notFoundPath = path.join(PUBLIC_DIR, '404.html');
      if (fs.existsSync(notFoundPath)) {
        res.writeHead(404, {
          'Content-Type': 'text/html; charset=utf-8',
          ...SECURITY_HEADERS,
        });
        fs.createReadStream(notFoundPath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS });
        res.end(`<!DOCTYPE html><html><body><h1>404 Not Found</h1></body></html>`);
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      ...SECURITY_HEADERS,
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Food Buddy local dev server running at: http://localhost:${PORT} and http://127.0.0.1:${PORT}`);
  console.log(`   - Landing:          http://localhost:${PORT}/`);
  console.log(`   - Login:            http://localhost:${PORT}/login`);
  console.log(`   - Register:         http://localhost:${PORT}/register`);
  console.log(`   - OTP:              http://localhost:${PORT}/otp`);
  console.log(`   - Student Portal:   http://localhost:${PORT}/student`);
  console.log(`   - Mess Manager:     http://localhost:${PORT}/manager`);
  console.log(`   - Higher Authority: http://localhost:${PORT}/authority`);
  console.log(`   - Onboarding:       http://localhost:${PORT}/onboarding`);
});
