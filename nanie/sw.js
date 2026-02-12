// sw.js - Global JSX Transpiler for Heyx Hub (Enhanced with Local Preview)

const CACHE_NAME = 'heyx-hub-v6';
const BABEL_URL = 'https://unpkg.com/@babel/standalone@7.23.5/babel.min.js';
const DB_NAME = 'HeyxHubPreview';
const STORE_NAME = 'files';

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

  // Check if it's a same-origin request that might be overridden
  if (url.origin === self.location.origin) {
     event.respondWith(handleRequest(event.request, url));
  } else {
     event.respondWith(fetch(event.request));
  }
});

// Helper to get local content from IndexedDB (Preview Mode)
function normalizePath(p) {
    if (!p) return p;
    return p.startsWith('/') ? p : '/' + p;
}

function getLocalContent(path) {
  const normalizedPath = normalizePath(path);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (e) => {
       if (!e.target.result.objectStoreNames.contains(STORE_NAME)) {
         e.target.result.createObjectStore(STORE_NAME);
       }
    };

    request.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
          resolve(null);
          return;
      }
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(normalizedPath);
      
      getReq.onsuccess = () => {
          const res = getReq.result;
          if (res && typeof res === 'object' && res.content !== undefined) {
              resolve(res.content);
          } else {
              resolve(res);
          }
      };
      getReq.onerror = () => resolve(null);
    };
    
    request.onerror = () => resolve(null);
  });
}

function getMimeType(path) {
    if (path.endsWith('.css')) return 'text/css';
    if (path.endsWith('.json')) return 'application/json';
    if (path.endsWith('.js')) return 'text/javascript';
    if (path.endsWith('.html')) return 'text/html';
    return 'text/plain';
}

async function handleRequest(request, url) {
  // 1. Check for Local Preview Override
  try {
      const localCode = await getLocalContent(url.pathname);
      if (localCode) {
          // If it's JSX, we still need to transpile it
          if (url.pathname.endsWith('.jsx')) {
              await loadBabel();
              return transpileCode(localCode, url.pathname);
          } 
          
          // Otherwise serve raw content with correct MIME type
          return new Response(localCode, {
              headers: { 
                  'Content-Type': getMimeType(url.pathname),
                  'Cache-Control': 'no-cache',
                  'X-Source': 'Local-Preview'
              }
          });
      }
  } catch (err) {
      console.error('Error checking local content:', err);
  }

  // 2. Standard Logic (JSX Transpilation or Network Fetch)
  
  // If it's JSX, use the special transpilation flow
  if (url.pathname.endsWith('.jsx')) {
      return handleJSXFallback(request, url);
  }

  // Otherwise, just fetch from network
  return fetch(request);
}

async function handleJSXFallback(request, url) {
  const cache = await caches.open(CACHE_NAME);
  const cacheKey = new Request(url.pathname);

  // In dev, try network first, fallback to cache
  if (isDevelopment) {
    try {
      return await fetchAndTranspile(request, url, cache, cacheKey);
    } catch (error) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      throw error;
    }
  }

  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  return fetchAndTranspile(request, url, cache, cacheKey);
}

async function fetchAndTranspile(request, url, cache, cacheKey) {
  const response = await fetch(request);
  if (!response.ok) throw new Error(`Failed to fetch ${url.pathname}`);
  const jsxCode = await response.text();

  await loadBabel();

  const jsResponse = transpileCode(jsxCode, url.pathname);
  
  // Cache the transpiled response
  await cache.put(cacheKey, jsResponse.clone());
  return jsResponse;
}

function transpileCode(code, filename) {
    try {
        const result = self.Babel.transform(code, {
            presets: [['react', { runtime: 'classic' }]],
            filename: filename,
            sourceMaps: 'inline'
        });

        return new Response(result.code, {
            headers: {
                'Content-Type': 'text/javascript; charset=utf-8',
                'Cache-Control': 'no-cache',
                'X-Source': 'Local-Preview' 
            }
        });
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