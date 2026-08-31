import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { HistoryItem, SharedCloudWork } from '../types';

const CONSENT_STORAGE_KEY = 'user_cloud_sync_consent';
const CLIENT_TAG_KEY = 'studio_client_anon_tag';

export function getClientTag(): string {
  try {
    let tag = localStorage.getItem(CLIENT_TAG_KEY);
    if (!tag) {
      tag = `User_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      localStorage.setItem(CLIENT_TAG_KEY, tag);
    }
    return tag;
  } catch {
    return 'User_GUEST';
  }
}

export function getUserConsentStatus(): boolean | null {
  try {
    const val = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (val === 'true') return true;
    if (val === 'false') return false;
    return null; // Not decided yet
  } catch {
    return null;
  }
}

export function setUserConsentStatus(allowed: boolean): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, allowed ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('cloud-consent-updated', { detail: { allowed } }));
  } catch (err) {
    console.warn('Could not save consent status', err);
  }
}

/**
 * Compresses an image Data URL to fit safely within Firestore's 1MB document limit (< 500KB)
 * while preserving high visual quality and text readability.
 */
async function compressImageForFirestore(dataUrl: string, maxDim = 1200, quality = 0.75): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    return dataUrl || '';
  }
  // If already under 350KB, return as-is
  if (dataUrl.length < 350000) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          // Scale down if larger than maxDim
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl.substring(0, 450000));
            return;
          }

          // Fill white background for transparent images
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to JPEG with compression
          let compressed = canvas.toDataURL('image/jpeg', quality);
          // If still over 550KB, reduce quality
          if (compressed.length > 550000) {
            compressed = canvas.toDataURL('image/jpeg', 0.55);
          }
          // If still over 550KB, downscale canvas
          if (compressed.length > 550000) {
            const smallerCanvas = document.createElement('canvas');
            smallerCanvas.width = Math.round(width * 0.7);
            smallerCanvas.height = Math.round(height * 0.7);
            const sCtx = smallerCanvas.getContext('2d');
            if (sCtx) {
              sCtx.fillStyle = '#ffffff';
              sCtx.fillRect(0, 0, smallerCanvas.width, smallerCanvas.height);
              sCtx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
              compressed = smallerCanvas.toDataURL('image/jpeg', 0.5);
            }
          }

          resolve(compressed);
        } catch (e) {
          console.warn('Canvas compression error:', e);
          resolve(dataUrl.substring(0, 450000));
        }
      };
      img.onerror = () => resolve(dataUrl.substring(0, 450000));
      img.src = dataUrl;
    } catch {
      resolve(dataUrl.substring(0, 450000));
    }
  });
}

/**
 * Sync a created work directly to Firebase Firestore in real-time background
 */
export async function syncWorkToCloud(
  item: Omit<HistoryItem, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
): Promise<boolean> {
  try {
    const workId = item.id || `work_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const workDocRef = doc(db, 'shared_works', workId);

    // Compress images so they never exceed Firestore's 1MB limit
    const rawImage = item.fullImageDataUrl || item.thumbnailUrl || '';
    const safeImage = await compressImageForFirestore(rawImage, 1200, 0.75);
    const safeThumbnail = await compressImageForFirestore(item.thumbnailUrl || rawImage, 400, 0.65);

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const directViewUrl = origin ? `${origin}/?admin_view=${workId}` : '';

    const payload: SharedCloudWork = {
      id: workId,
      title: item.title,
      toolType: item.toolType,
      thumbnailUrl: safeThumbnail,
      fullImageDataUrl: safeImage,
      pdfDataUrl: '', // PDFs are downloaded directly, store image in Cloud
      directViewUrl: directViewUrl,
      details: item.details || '',
      fileSizeText: item.fileSizeText || '',
      itemCount: item.itemCount || 1,
      createdAt: new Date(item.timestamp || Date.now()).toISOString(),
      userConsent: true,
      clientTag: getClientTag(),
    };

    await setDoc(workDocRef, payload);
    console.log(`✓ Cloud sync success for work: ${workId}`);
    return true;
  } catch (error) {
    console.error('Firebase sync failed:', error);
    return false;
  }
}

/**
 * Fetch all shared works from Firebase Cloud (For Admin / Owner Dashboard)
 */
export async function fetchAllCloudSharedWorks(): Promise<SharedCloudWork[]> {
  try {
    const worksCollection = collection(db, 'shared_works');
    const q = query(worksCollection, orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);

    const items: SharedCloudWork[] = [];
    snapshot.forEach((docSnapshot) => {
      items.push(docSnapshot.data() as SharedCloudWork);
    });

    return items;
  } catch (error) {
    console.error('Error fetching cloud works:', error);
    return [];
  }
}

/**
 * Fetch a single shared work from Firebase Cloud by ID
 */
export async function fetchSingleCloudSharedWork(id: string): Promise<SharedCloudWork | null> {
  try {
    const { getDoc } = await import('firebase/firestore');
    const workDocRef = doc(db, 'shared_works', id);
    const snap = await getDoc(workDocRef);
    if (snap.exists()) {
      return snap.data() as SharedCloudWork;
    }
    return null;
  } catch (error) {
    console.error('Error fetching single cloud work:', error);
    return null;
  }
}

/**
 * Delete a shared work from Firebase Cloud
 */
export async function deleteCloudSharedWork(id: string): Promise<boolean> {
  try {
    const workDocRef = doc(db, 'shared_works', id);
    await deleteDoc(workDocRef);
    return true;
  } catch (error) {
    console.error('Error deleting cloud work:', error);
    return false;
  }
}
