import express from 'express';
import path from 'path';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';

// In-memory cache for high-speed repeated proxy requests and back/forward navigation
interface CacheItem {
  status: number;
  contentType: string;
  body: string | Buffer;
  timestamp: number;
}
const proxyMemoryCache = new Map<string, CacheItem>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache
const MAX_CACHE_SIZE = 150;

function getCached(url: string): CacheItem | null {
  const item = proxyMemoryCache.get(url);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    proxyMemoryCache.delete(url);
    return null;
  }
  return item;
}

function setCached(url: string, status: number, contentType: string, body: string | Buffer) {
  if (proxyMemoryCache.size >= MAX_CACHE_SIZE) {
    const firstKey = proxyMemoryCache.keys().next().value;
    if (firstKey) proxyMemoryCache.delete(firstKey);
  }
  proxyMemoryCache.set(url, { status, contentType, body, timestamp: Date.now() });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // HTTP GZIP / Deflate Compression - Dramatically boosts page transfer speed
  app.use(compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));

  app.use(express.json());

  // Static files in public directory (manifest, icons, service worker)
  const publicDir = path.join(process.cwd(), 'public');
  app.use(express.static(publicDir, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (filePath.endsWith('manifest.json') || filePath.endsWith('manifest.webmanifest')) {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      } else if (filePath.endsWith('sw.js')) {
        res.setHeader('Service-Worker-Allowed', '/');
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      }
    }
  }));

  // Explicit PWA Manifest endpoints with CORS wildcard
  app.get(['/manifest.json', '/manifest.webmanifest', '/api/manifest'], (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(publicDir, 'manifest.json'));
  });

  // Explicit Service Worker endpoint
  app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(publicDir, 'sw.js'));
  });

  // API Proxy Route - Bypasses CORS & X-Frame-Options with caching
  app.get('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send('Missing url parameter');
    }

    let urlToFetch = targetUrl;
    if (!/^https?:\/\//i.test(urlToFetch)) {
      urlToFetch = 'https://' + urlToFetch;
    }

    // 1. Instant cache check for lightning-fast repeat visits
    const cached = getCached(urlToFetch);
    if (cached) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Proxy-Cache', 'HIT');
      res.setHeader('Content-Type', cached.contentType);
      res.status(cached.status);
      return res.send(cached.body);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s fast abort for unresponsive sites

      const response = await fetch(urlToFetch, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 WebBrowserSimulator/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      
      // Transfer status
      res.status(response.status);

      // Set CORS headers to allow browser interaction
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('X-Proxy-Cache', 'MISS');
      
      // Strip framing barriers
      res.removeHeader('Content-Security-Policy');
      res.removeHeader('X-Frame-Options');
      res.removeHeader('Frame-Options');
      res.removeHeader('X-Content-Type-Options');

      if (contentType.includes('text/html')) {
        let html = await response.text();

        // Target URL after any server-side redirects
        const finalUrl = response.url || urlToFetch;

        // Base tag forces relative assets (CSS, images, JS) to resolve to the target site directly
        const baseTag = `<base href="${finalUrl}">`;
        
        // Client-side script injected into the proxy webpage
        // Intercepts relative and absolute links to post messages back to our React application
        const scriptToInject = `
<script>
  (function() {
    // Intercept navigation on <a> elements
    document.addEventListener('click', function(e) {
      var target = e.target.closest('a');
      if (target && target.href) {
        // Skip javascript: and anchors within same page
        var href = target.getAttribute('href');
        if (target.href.startsWith('javascript:') || href === '#' || (href && href.startsWith('#'))) {
          return;
        }
        
        e.preventDefault();
        
        // Notify React parent page about the navigation request
        window.parent.postMessage({
          type: 'NAVIGATE',
          url: target.href
        }, '*');
      }
    }, true);

    // Intercept form GET submissions to navigate browser correctly
    document.addEventListener('submit', function(e) {
      var form = e.target;
      var action = form.action || window.location.href;
      var method = (form.method || 'GET').toUpperCase();
      
      if (method === 'GET') {
        e.preventDefault();
        var formData = new FormData(form);
        var params = new URLSearchParams();
        for (var pair of formData.entries()) {
          params.append(pair[0], pair[1]);
        }
        var targetUrl = action + (action.indexOf('?') === -1 ? '?' : '&') + params.toString();
        
        window.parent.postMessage({
          type: 'NAVIGATE',
          url: targetUrl
        }, '*');
      }
    }, true);

    // Relay standard alerts to React UI
    window.alert = function(msg) {
      window.parent.postMessage({ type: 'ALERT', message: msg }, '*');
    };
    
    // Relay window.open triggers
    window.open = function(url) {
      window.parent.postMessage({ type: 'NAVIGATE', url: url }, '*');
      return null;
    };
  })();
</script>
        `;

        // Safely inject base tag and tracking scripts right at the start of the document head
        if (html.includes('<head>')) {
          html = html.replace('<head>', `<head>${baseTag}${scriptToInject}`);
        } else if (html.includes('<HEAD>')) {
          html = html.replace('<HEAD>', `<HEAD>${baseTag}${scriptToInject}`);
        } else {
          html = baseTag + scriptToInject + html;
        }

        const finalContentType = 'text/html; charset=utf-8';
        res.setHeader('Content-Type', finalContentType);
        
        // Store in fast memory cache if successful 200 response
        if (response.status === 200) {
          setCached(urlToFetch, 200, finalContentType, html);
        }

        return res.send(html);
      } else {
        // Pipe static assets such as styling or images if requested via the proxy
        const buffer = await response.arrayBuffer();
        const nodeBuffer = Buffer.from(buffer);
        res.setHeader('Content-Type', contentType);
        
        if (response.status === 200 && nodeBuffer.length < 500000) {
          setCached(urlToFetch, 200, contentType, nodeBuffer);
        }

        return res.send(nodeBuffer);
      }

    } catch (err: any) {
      console.error('Error fetching proxied URL:', urlToFetch, err);
      
      // Elegant, styled inside-browser error screen
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(500).send(`
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #0f172a;
      color: #e2e8f0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      text-align: center;
      padding: 20px;
    }
    .card {
      background: #1e293b;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 100%;
      border: 1px solid #334155;
    }
    h1 { font-size: 22px; margin-bottom: 12px; color: #f43f5e; font-weight: 600; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-top: 0; }
    .url { font-family: monospace; background: #0f172a; padding: 8px 12px; border-radius: 6px; color: #38bdf8; word-break: break-all; margin: 18px 0; font-size: 13px; border: 1px solid #334155; display: inline-block; max-width: 90%; }
    .btn { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 500; cursor: pointer; text-decoration: none; display: inline-block; font-size: 14px; transition: background 0.2s; }
    .btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Connect Failure</h1>
    <p>Web Browser failed to open this address. The site may be offline, restricting CORS requests, or experiencing connection issues.</p>
    <div class="url">${targetUrl}</div>
    <p style="font-size: 12px; color: #64748b; font-family: monospace;">Reason: ${err.message || err}</p>
    <button class="btn" onclick="window.parent.postMessage({type: 'RELOAD'}, '*')">Refresh Page</button>
  </div>
</body>
</html>
      `);
    }
  });

  // API Source Route for Simulated DevTools (fetches original HTML + headers)
  app.get('/api/source', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).json({ error: 'Missing url parameter' });
    let urlToFetch = targetUrl;
    if (!/^https?:\/\//i.test(urlToFetch)) urlToFetch = 'https://' + urlToFetch;

    try {
      const response = await fetch(urlToFetch, {
        headers: {
          'User-Agent': 'Mozilla/5.0 WebBrowserSimulator/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      const html = await response.text();
      res.json({
        url: response.url || urlToFetch,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        html: html
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch page source' });
    }
  });

  // Serve static assets in production, otherwise Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web Browser server running on http://localhost:${PORT}`);
  });
}

startServer();
