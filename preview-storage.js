const DB_NAME = 'HeyxHubPreview';
const STORE_NAME = 'files';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e);
    });
}

function normalizePath(p) {
    if (!p) return p;
    // Ensure path starts with /
    return p.startsWith('/') ? p : '/' + p;
}

export async function saveFileOverride(path, content, timestamp = Date.now()) {
    const db = await openDB();
    const normalizedPath = normalizePath(path);
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        const getReq = store.get(normalizedPath);
        
        getReq.onsuccess = () => {
            const existing = getReq.result;
            // If we have a newer version already, ignore this update
            if (existing && existing.timestamp && existing.timestamp > timestamp) {
                resolve(false); // Skipped
                return;
            }
            
            // Store with timestamp
            const putReq = store.put({ content, timestamp }, normalizedPath);
            putReq.onsuccess = () => resolve(true);
            putReq.onerror = (e) => reject(e);
        };
        
        getReq.onerror = (e) => reject(e);
    });
}

export async function getFileOverride(path) {
    const db = await openDB();
    const normalizedPath = normalizePath(path);
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(normalizedPath);
        
        request.onsuccess = () => {
            const res = request.result;
            // Handle { content, timestamp } object or legacy string
            if (res && typeof res === 'object' && res.content !== undefined) {
                resolve(res.content);
            } else {
                resolve(res);
            }
        };
        request.onerror = (e) => reject(e);
    });
}

export async function removeFileOverride(path) {
    const db = await openDB();
    const normalizedPath = normalizePath(path);
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(normalizedPath);
        
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e);
    });
}

export async function clearAllOverrides() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();
        
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e);
    });
}