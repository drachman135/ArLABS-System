/**
 * devNotesSyncEngine.ts
 * Engine sinkronisasi offline → online khusus untuk fitur Dev Notes.
 * 
 * Cara kerja:
 * 1. Saat offline, semua perubahan (INSERT/UPDATE/DELETE) disimpan di antrian IndexedDB
 * 2. Saat online kembali, engine ini berjalan dan memproses antrian satu per satu ke Supabase
 * 3. Setelah berhasil, item dihapus dari antrian
 */

import { supabase } from './supabase';
import {
  getAllSyncQueue,
  dequeueSync,
  getSyncQueueCount,
  type SyncQueueItem,
} from './offlineStorage';

// Event yang dipancarkan saat sinkronisasi selesai
export const SYNC_COMPLETE_EVENT = 'arlabs:sync-complete';
export const SYNC_START_EVENT = 'arlabs:sync-start';

let isSyncing = false;

/**
 * Memproses seluruh antrian sinkronisasi.
 * Harus dipanggil setiap kali status jaringan berubah ke online.
 * 
 * @returns Jumlah item yang berhasil disinkronkan
 */
export const processSyncQueue = async (): Promise<number> => {
  if (isSyncing) {
    console.log('[SyncEngine] Already syncing, skipping...');
    return 0;
  }

  const pendingCount = await getSyncQueueCount();
  if (pendingCount === 0) return 0;

  isSyncing = true;
  window.dispatchEvent(new CustomEvent(SYNC_START_EVENT, { detail: { count: pendingCount } }));
  console.log(`[SyncEngine] Starting sync: ${pendingCount} item(s) pending`);

  const queue = await getAllSyncQueue();
  let successCount = 0;
  const errors: Array<{ item: SyncQueueItem; error: any }> = [];

  for (const item of queue) {
    try {
      await processItem(item);
      await dequeueSync(item.queueId!);
      successCount++;
      console.log(`[SyncEngine] ✅ Synced [${item.operation}] on ${item.tableName} (queueId: ${item.queueId})`);
    } catch (err) {
      console.error(`[SyncEngine] ❌ Failed to sync [${item.operation}] on ${item.tableName}:`, err);
      errors.push({ item, error: err });
    }
  }

  isSyncing = false;

  window.dispatchEvent(
    new CustomEvent(SYNC_COMPLETE_EVENT, {
      detail: { successCount, errorCount: errors.length },
    })
  );

  if (successCount > 0) {
    console.log(`[SyncEngine] Sync complete: ${successCount} success, ${errors.length} failed`);
  }

  return successCount;
};

/**
 * Memproses satu item dari antrian sinkronisasi.
 */
const processItem = async (item: SyncQueueItem): Promise<void> => {
  const { tableName, operation, payload, remoteId } = item;

  switch (operation) {
    case 'INSERT': {
      // Hapus field localId dari payload sebelum insert
      const { _localId, ...insertPayload } = payload;
      const { error } = await supabase.from(tableName).insert([insertPayload]);
      if (error) throw error;
      break;
    }

    case 'UPDATE': {
      if (!remoteId) throw new Error('remoteId is required for UPDATE operation');
      const { _localId, ...updatePayload } = payload;
      const { error } = await supabase
        .from(tableName)
        .update(updatePayload)
        .eq('id', remoteId);
      if (error) throw error;
      break;
    }

    case 'DELETE': {
      if (!remoteId) throw new Error('remoteId is required for DELETE operation');
      const { error } = await supabase.from(tableName).delete().eq('id', remoteId);
      if (error) throw error;
      break;
    }

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
};

/**
 * Mengecek apakah ada item yang menunggu sinkronisasi.
 */
export const hasPendingSync = async (): Promise<boolean> => {
  const count = await getSyncQueueCount();
  return count > 0;
};
