/**
 * offlineStorage.ts
 * IndexedDB wrapper untuk caching data Supabase saat offline.
 * Digunakan oleh semua fitur yang membutuhkan akses data saat tidak ada koneksi.
 */

const DB_NAME = 'arlabs_offline_db';
const DB_VERSION = 1;

// Nama object stores yang tersedia di IndexedDB
const STORES = {
  CACHE: 'cache',              // Data snapshot dari Supabase (read-only cache)
  SYNC_QUEUE: 'sync_queue',    // Antrian mutasi offline yang belum disinkronkan
} as const;

let dbInstance: IDBDatabase | null = null;

/**
 * Membuka koneksi ke IndexedDB. Singleton pattern.
 */
const openDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store untuk cache snapshot data
      if (!db.objectStoreNames.contains(STORES.CACHE)) {
        db.createObjectStore(STORES.CACHE, { keyPath: 'cacheKey' });
      }

      // Store untuk antrian sinkronisasi offline
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, {
          keyPath: 'queueId',
          autoIncrement: true,
        });
        syncStore.createIndex('table_name', 'tableName', { unique: false });
        syncStore.createIndex('created_at', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('[OfflineStorage] Failed to open IndexedDB:', event);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

// ─────────────────────────────────────────────
// Cache API (untuk snapshot data Supabase)
// ─────────────────────────────────────────────

export interface CacheEntry<T = any> {
  cacheKey: string;
  data: T;
  cachedAt: string; // ISO timestamp
}

/**
 * Menyimpan data ke cache IndexedDB.
 * @param key - Kunci unik untuk mengidentifikasi data (misal: 'customers', 'dev_notes_app123')
 * @param data - Data yang akan disimpan
 */
export const setCache = async <T>(key: string, data: T): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CACHE, 'readwrite');
      const store = tx.objectStore(STORES.CACHE);
      const entry: CacheEntry<T> = {
        cacheKey: key,
        data,
        cachedAt: new Date().toISOString(),
      };
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineStorage] setCache failed:', err);
  }
};

/**
 * Mengambil data dari cache IndexedDB.
 * @param key - Kunci cache yang ingin diambil
 * @returns Data yang tersimpan, atau null jika tidak ada
 */
export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CACHE, 'readonly');
      const store = tx.objectStore(STORES.CACHE);
      const req = store.get(key);
      req.onsuccess = () => {
        const entry = req.result as CacheEntry<T> | undefined;
        resolve(entry ? entry.data : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineStorage] getCache failed:', err);
    return null;
  }
};

/**
 * Menghapus semua data cache. Berguna saat logout.
 */
export const clearAllCache = async (): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CACHE, 'readwrite');
      const store = tx.objectStore(STORES.CACHE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineStorage] clearAllCache failed:', err);
  }
};

// ─────────────────────────────────────────────
// Sync Queue API (untuk Dev Notes offline write)
// ─────────────────────────────────────────────

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface SyncQueueItem {
  queueId?: number;          // Auto-increment primary key
  tableName: string;         // Nama tabel Supabase (misal: 'dev_notes')
  operation: SyncOperation;  // Jenis operasi
  payload: any;              // Data yang akan dikirim ke Supabase
  localId?: string;          // ID lokal sementara (untuk INSERT baru)
  remoteId?: string;         // ID di Supabase (untuk UPDATE/DELETE)
  createdAt: string;         // ISO timestamp saat operasi dibuat
}

/**
 * Menambahkan operasi ke antrian sinkronisasi.
 * Dipanggil saat offline dan pengguna melakukan perubahan data.
 */
export const enqueueSync = async (item: Omit<SyncQueueItem, 'createdAt'>): Promise<number> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const entry: SyncQueueItem = {
      ...item,
      createdAt: new Date().toISOString(),
    };
    const req = store.add(entry);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
};

/**
 * Mengambil semua item dari antrian sinkronisasi, diurutkan berdasarkan waktu.
 */
export const getAllSyncQueue = async (): Promise<SyncQueueItem[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as SyncQueueItem[]).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineStorage] getAllSyncQueue failed:', err);
    return [];
  }
};

/**
 * Menghapus item dari antrian sinkronisasi setelah berhasil disinkronkan.
 */
export const dequeueSync = async (queueId: number): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const req = store.delete(queueId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

/**
 * Menghapus semua item di antrian sinkronisasi.
 */
export const clearSyncQueue = async (): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineStorage] clearSyncQueue failed:', err);
  }
};

/**
 * Mengambil jumlah item yang menunggu sinkronisasi.
 */
export const getSyncQueueCount = async (): Promise<number> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return 0;
  }
};
