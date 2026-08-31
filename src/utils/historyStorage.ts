import { HistoryItem } from '../types';
import { syncWorkToCloud } from './cloudSync';

const DB_NAME = 'PhotoPdfStudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'creations_history';
const LOCAL_STORAGE_KEY = 'creations_history_cache';

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize IndexedDB instance safely
 */
async function openDB(): Promise<IDBDatabase | null> {
  if (dbInstance) return dbInstance;
  if (typeof window === 'undefined' || !window.indexedDB) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('toolType', 'toolType', { unique: false });
        }
      };

      request.onsuccess = () => {
        dbInstance = request.result;
        dbInstance.onversionchange = () => {
          dbInstance?.close();
          dbInstance = null;
        };
        resolve(dbInstance);
      };

      request.onerror = (err) => {
        console.warn('IndexedDB open error, using localStorage fallback', err);
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('IndexedDB open blocked');
        resolve(null);
      };
    } catch (e) {
      console.warn('IndexedDB exception', e);
      resolve(null);
    }
  });
}

function getLocalList(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveLocalList(list: HistoryItem[]): void {
  try {
    // Only save up to 30 items and strip large base64 from localStorage fallback to avoid quota errors
    const sanitized = list.slice(0, 30).map((item) => ({
      ...item,
      // If thumbnail is huge, keep it reasonable
      thumbnailUrl: item.thumbnailUrl?.length > 300000 ? item.thumbnailUrl.substring(0, 300000) : item.thumbnailUrl,
      fullImageDataUrl: undefined,
      pdfDataUrl: undefined,
    }));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('localStorage save warning:', err);
  }
}

/**
 * Save an item to creation history
 */
export async function saveToHistory(
  item: Omit<HistoryItem, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
): Promise<HistoryItem> {
  const finalItem: HistoryItem = {
    id: item.id || `hist_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    timestamp: item.timestamp || Date.now(),
    title: item.title,
    toolType: item.toolType,
    thumbnailUrl: item.thumbnailUrl,
    fullImageDataUrl: item.fullImageDataUrl,
    pdfDataUrl: item.pdfDataUrl,
    fileSizeText: item.fileSizeText,
    details: item.details,
    itemCount: item.itemCount,
  };

  // 1. Immediately update localStorage backup
  const currentLocal = getLocalList();
  const updatedLocal = [finalItem, ...currentLocal.filter((x) => x.id !== finalItem.id)];
  saveLocalList(updatedLocal);

  // 2. Persist to IndexedDB
  try {
    const db = await openDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(finalItem);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch (err) {
    console.warn('IndexedDB write error', err);
  }

  // 3. Sync to Firebase Cloud if user granted consent
  try {
    syncWorkToCloud(finalItem).catch((err) => console.warn('Cloud sync error:', err));
  } catch (err) {
    console.warn('Sync trigger error:', err);
  }

  // Notify UI
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('history-updated', { detail: finalItem }));
  }

  return finalItem;
}

/**
 * Fetch all history items ordered from newest to oldest
 */
export async function getAllHistory(): Promise<HistoryItem[]> {
  let dbItems: HistoryItem[] | null = null;

  try {
    const db = await openDB();
    if (db) {
      dbItems = await new Promise<HistoryItem[]>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => {
            const items = (req.result as HistoryItem[]) || [];
            resolve(items);
          };
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
    }
  } catch (err) {
    console.warn('IndexedDB read error', err);
  }

  if (dbItems && dbItems.length > 0) {
    return dbItems.sort((a, b) => b.timestamp - a.timestamp);
  }

  // Fallback to localStorage
  const localList = getLocalList();
  return localList.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Delete a single history item by id
 */
export async function deleteHistoryItem(id: string): Promise<boolean> {
  // 1. Instantly update localStorage
  const currentLocal = getLocalList();
  const updatedLocal = currentLocal.filter((x) => x.id !== id);
  saveLocalList(updatedLocal);

  // 2. Delete from IndexedDB
  try {
    const db = await openDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch (err) {
    console.warn('IndexedDB delete error', err);
  }

  // Notify UI
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('history-updated'));
  }

  return true;
}

/**
 * Clear all history
 */
export async function clearAllHistory(): Promise<boolean> {
  // 1. Clear localStorage
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {}

  // 2. Clear IndexedDB
  try {
    const db = await openDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch (err) {
    console.warn('IndexedDB clear error', err);
  }

  // Notify UI
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('history-updated'));
  }

  return true;
}

