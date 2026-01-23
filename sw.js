// sw.js - Global JSX Transpiler for Heyx Hub

const CACHE_NAME = 'heyx-hub-v3';
const BABEL_URL = 'https://unpkg.com/@babel/standalone@7.23.5/babel.min.js';

// Development mode: always fetch fresh in dev
const isDevelopment = self.location.hostname === 'localhost' ||
                      self.location.hostname === '127.0.0.1';

let babelLoaded = false;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.add(BABEL_URL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept ALL .jsx files from same origin
  if (url.origin === self.location.origin && url.pathname.endsWith('.jsx')) {
    event.respondWith(handleJSXRequest(event.request, url));
  } else {
    event.respondWith(fetch(event.request));
  }
});

async function handleJSXRequest(request, url) {
  const cache = await caches.open(CACHE_NAME);
  const cacheKey = new Request(url.pathname);

  // In dev, try network first, fallback to cache
  if (isDevelopment) {
    try {
      return await transpileAndCache(request, url, cache, cacheKey);
    } catch (error) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      throw error;
    }
  }

  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  return transpileAndCache(request, url, cache, cacheKey);
}

async function transpileAndCache(request, url, cache, cacheKey) {
  const response = await fetch(request);
  if (!response.ok) throw new Error(`Failed to fetch ${url.pathname}`);
  const jsxCode = await response.text();

  await loadBabel();

  try {
    const result = self.Babel.transform(jsxCode, {
      presets: [['react', { runtime: 'classic' }]],
      filename: url.pathname,
      sourceMaps: 'inline'
    });

    const jsResponse = new Response(result.code, {
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });

    await cache.put(cacheKey, jsResponse.clone());
    return jsResponse;
  } catch (e) {
    console.error('Transpilation failed:', e);
    throw e;
  }
}

async function loadBabel() {
  if (babelLoaded) return;
  const cache = await caches.open(CACHE_NAME);
  let babelResponse = await cache.match(BABEL_URL);
  if (!babelResponse) {
    babelResponse = await fetch(BABEL_URL);
    await cache.put(BABEL_URL, babelResponse.clone());
  }
  const babelCode = await babelResponse.text();
  self.eval(babelCode);
  babelLoaded = true;
}
