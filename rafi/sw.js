// sw.js - JSX Transpiler Service Worker

const CACHE_NAME = 'react-template-v1';
const BABEL_URL = 'https://unpkg.com/@babel/standalone@7.23.5/babel.min.js';

// Development mode: use network-first for localhost/127.0.0.1
const isDevelopment = self.location.hostname === 'localhost' ||
                      self.location.hostname === '127.0.0.1' ||
                      self.location.hostname === '';

let babelLoaded = false;

// ============================================
// INSTALL: Pre-cache Babel
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing JSX transpiler...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching Babel Standalone...');
        return cache.add(BABEL_URL);
      })
      .then(() => {
        console.log('[SW] Install complete');
        return self.skipWaiting(); // Activate immediately
      })
  );
});

// ============================================
// ACTIVATE: Take control
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');

  event.waitUntil(
    // Clean up old caches
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
    .then(() => {
      console.log('[SW] Claiming clients...');
      return self.clients.claim();
    })
    .then(() => {
      console.log('[SW] Service Worker active and ready!');
    })
  );
});

// ============================================
// FETCH: Intercept ALL .jsx files for ES6 module transpilation
// ============================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept ALL .jsx files from same origin
  if (url.origin === self.location.origin && url.pathname.endsWith('.jsx')) {
    console.log('[SW] Intercepting JSX file:', url.pathname);
    event.respondWith(handleJSXRequest(event.request, url));
  } else {
    // Pass through all other requests
    event.respondWith(fetch(event.request));
  }
});

// ============================================
// MAIN HANDLER: Fetch, Transpile, Cache
// ============================================
async function handleJSXRequest(request, url) {
  const cache = await caches.open(CACHE_NAME);
  const cacheKey = new Request(url.pathname);

  // DEVELOPMENT MODE: Network-first (always fetch latest)
  if (isDevelopment) {
    console.log('[SW] 🛠️  Dev mode: fetching fresh:', url.pathname);
    try {
      const freshResponse = await transpileAndCache(request, url, cache, cacheKey);
      return freshResponse;
    } catch (error) {
      // Fallback to cache if network fails
      const cached = await cache.match(cacheKey);
      if (cached) {
        console.log('[SW] ⚠️  Network failed, using cache:', url.pathname);
        return cached;
      }
      throw error;
    }
  }

  // PRODUCTION MODE: Cache-first
  const cached = await cache.match(cacheKey);
  if (cached) {
    console.log('[SW] ✓ Cache hit:', url.pathname);
    return cached;
  }

  console.log('[SW] ⟳ Transpiling:', url.pathname);
  return transpileAndCache(request, url, cache, cacheKey);
}

// ============================================
// TRANSPILE AND CACHE: Reusable transpilation logic
// ============================================
async function transpileAndCache(request, url, cache, cacheKey) {
  try {
    // Step 1: Fetch the original JSX source
    const response = await fetch(request);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url.pathname}: ${response.statusText}`);
    }
    const jsxCode = await response.text();

    // Step 2: Ensure Babel is loaded
    await loadBabel();

    // Step 3: Transpile JSX to JavaScript
    const result = self.Babel.transform(jsxCode, {
      presets: [
        ['react', { runtime: 'classic' }]
      ],
      filename: url.pathname,
      sourceMaps: 'inline' // Helpful for debugging
    });

    const transpiledCode = result.code;
    console.log('[SW] ✓ Transpiled:', url.pathname, `(${jsxCode.length} → ${transpiledCode.length} bytes)`);

    // Step 4: Create response with correct Content-Type
    const jsResponse = new Response(transpiledCode, {
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'X-Transpiled-From': 'JSX',
        'X-Dev-Mode': isDevelopment ? 'true' : 'false',
        'Cache-Control': 'no-cache' // Let SW handle caching
      }
    });

    // Step 5: Cache the transpiled result
    await cache.put(cacheKey, jsResponse.clone());

    // Step 6: Return to browser
    return jsResponse;

  } catch (error) {
    console.error('[SW] ✗ Transpilation error:', url.pathname, error);

    // Return error as JavaScript that will throw in browser
    const errorCode = `
      console.error('JSX Transpilation Error in ${url.pathname}:', ${JSON.stringify(error.message)});
      throw new Error('Failed to transpile ${url.pathname}: ${error.message}');
    `;

    return new Response(errorCode, {
      status: 500,
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8'
      }
    });
  }
}

// ============================================
// LOAD BABEL: Execute in SW context
// ============================================
async function loadBabel() {
  if (babelLoaded) return;

  console.log('[SW] Loading Babel Standalone...');

  try {
    const cache = await caches.open(CACHE_NAME);
    let babelResponse = await cache.match(BABEL_URL);

    // Fallback to network if not cached
    if (!babelResponse) {
      console.log('[SW] Babel not in cache, fetching from network...');
      babelResponse = await fetch(BABEL_URL);
      await cache.put(BABEL_URL, babelResponse.clone());
    }

    const babelCode = await babelResponse.text();

    // Execute Babel in service worker global scope
    self.eval(babelCode);

    if (!self.Babel) {
      throw new Error('Babel failed to load into service worker context');
    }

    babelLoaded = true;
    console.log('[SW] ✓ Babel loaded, version:', self.Babel.version);

  } catch (error) {
    console.error('[SW] ✗ Failed to load Babel:', error);
    throw error;
  }
}

// ============================================
// MESSAGE HANDLER: Clear cache on demand
// ============================================
self.addEventListener('message', (event) => {
  if (event.data === 'clearCache') {
    console.log('[SW] Clearing JSX cache...');
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log('[SW] ✓ Cache cleared');
        event.ports[0].postMessage({ success: true });
      })
    );
  }

  if (event.data === 'skipWaiting') {
    console.log('[SW] Forcing update...');
    self.skipWaiting();
  }
});
