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

export async function saveFileOverride(path, content) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(content, path); // key is path (e.g., '/app.jsx')
        
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e);
    });
}

export async function getFileOverride(path) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(path);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e);
    });
}

export async function removeFileOverride(path) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(path);
        
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
