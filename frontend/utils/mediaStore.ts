/**
 * Media store (client-side)
 * =========================
 * Persists user-uploaded audio/video in the browser via IndexedDB so the
 * Media page can host files without any backend. Blobs live on the device
 * that uploaded them (they are not synced to a server), which keeps the
 * feature zero-maintenance — nothing new to run or store server-side.
 *
 * IndexedDB (not localStorage) is used because it stores Blobs directly and
 * handles the tens-of-MB sizes typical of audio/video, which localStorage
 * cannot.
 */

const DB_NAME = 'betgistics-media';
const STORE = 'files';
const VERSION = 1;

export type MediaKind = 'audio' | 'video';

export interface StoredMedia {
  id: string;
  name: string;
  kind: MediaKind;
  mime: string;
  size: number;
  addedAt: number;
  blob: Blob;
}

/** Metadata only (no Blob) — what the UI lists. Blobs are fetched on demand. */
export type MediaMeta = Omit<StoredMedia, 'blob'>;

export function isMediaSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function detectKind(mime: string): MediaKind | null {
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return null;
}

/** List stored media metadata, newest first. Blobs are omitted for speed. */
export async function listMedia(): Promise<MediaMeta[]> {
  const db = await openDB();
  try {
    const items = await new Promise<StoredMedia[]>((resolve, reject) => {
      const req = tx(db, 'readonly').getAll();
      req.onsuccess = () => resolve(req.result as StoredMedia[]);
      req.onerror = () => reject(req.error);
    });
    return items
      .map(({ blob: _blob, ...meta }) => meta)
      .sort((a, b) => b.addedAt - a.addedAt);
  } finally {
    db.close();
  }
}

/** Fetch a single stored Blob by id (for playback via object URL). */
export async function getMediaBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  try {
    const item = await new Promise<StoredMedia | undefined>((resolve, reject) => {
      const req = tx(db, 'readonly').get(id);
      req.onsuccess = () => resolve(req.result as StoredMedia | undefined);
      req.onerror = () => reject(req.error);
    });
    return item?.blob ?? null;
  } finally {
    db.close();
  }
}

/**
 * Store an uploaded file. Rejects anything that is not audio/* or video/*.
 * Returns the saved metadata.
 */
export async function addMedia(file: File): Promise<MediaMeta> {
  const kind = detectKind(file.type);
  if (!kind) {
    throw new Error('Only audio and video files are supported.');
  }
  const record: StoredMedia = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: file.name || `${kind}-${Date.now()}`,
    kind,
    mime: file.type,
    size: file.size,
    addedAt: Date.now(),
    blob: file,
  };
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const req = tx(db, 'readwrite').put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
  const { blob: _blob, ...meta } = record;
  return meta;
}

/** Delete a stored media item by id. */
export async function deleteMedia(id: string): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const req = tx(db, 'readwrite').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
