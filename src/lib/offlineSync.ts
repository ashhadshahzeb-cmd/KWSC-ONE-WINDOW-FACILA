import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type OfflineAction = 'INSERT' | 'UPDATE' | 'DELETE';

export interface OfflineMutation {
  id: string; // unique ID for the mutation queue
  table: string;
  action: OfflineAction;
  payload: any;
  timestamp: number;
}

const QUEUE_KEY = 'kwsc_offline_queue';

export function getOfflineQueue(): OfflineMutation[] {
  try {
    const q = localStorage.getItem(QUEUE_KEY);
    return q ? JSON.parse(q) : [];
  } catch (e) {
    return [];
  }
}

export function addToOfflineQueue(table: string, action: OfflineAction, payload: any) {
  const queue = getOfflineQueue();
  let uuid = '';
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    uuid = crypto.randomUUID();
  } else {
    uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  const mutation: OfflineMutation = {
    id: uuid,
    table,
    action,
    payload,
    timestamp: Date.now(),
  };
  
  queue.push(mutation);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  
  // Dispatch a custom event so UI can update immediately
  window.dispatchEvent(new Event('offline-queue-updated'));
}

export function clearOfflineQueue() {
  localStorage.removeItem(QUEUE_KEY);
  window.dispatchEvent(new Event('offline-queue-updated'));
}

export async function processOfflineQueue() {
  if (!navigator.onLine) return;
  
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  toast.info(`Syncing ${queue.length} offline changes to cloud...`, { id: 'sync-toast' });
  
  let successCount = 0;
  let failedQueue: OfflineMutation[] = [];

  for (const mutation of queue) {
    try {
      let error = null;

      if (mutation.action === 'INSERT') {
        const { is_dirty, deleted_locally, file_image, file_images, ...cleanPayload } = mutation.payload;
        let { error: err } = await supabase.from(mutation.table as any).insert(cleanPayload);
        
        // If it fails because columns don't exist (code 42703 or PGRST204), retry without them
        if (err && (err.code === '42703' || err.code === 'PGRST204')) {
          const { additional_mark_to, status, ...safePayload } = cleanPayload as any;
          const retry = await supabase.from(mutation.table as any).insert(safePayload);
          err = retry.error;
        }
        
        error = err;
      } else if (mutation.action === 'UPDATE') {
        const { id, is_dirty, deleted_locally, file_image, file_images, ...updateData } = mutation.payload;
        // Specifically for file_tracking_records, we might update by receiving_number if id is not present but usually id is present
        const matchField = id ? { id } : { receiving_number: updateData.receiving_number };
        let { error: err } = await supabase.from(mutation.table as any).update(updateData).match(matchField);
        
        if (err && (err.code === '42703' || err.code === 'PGRST204')) {
          const { additional_mark_to, status, ...safeUpdateData } = updateData as any;
          const retry = await supabase.from(mutation.table as any).update(safeUpdateData).match(matchField);
          err = retry.error;
        }
        
        error = err;
      } else if (mutation.action === 'DELETE') {
        const { id } = mutation.payload;
        const { error: err } = await supabase.from(mutation.table as any).delete().eq('id', id);
        error = err;
      }

      if (error) {
        console.error('Failed to sync mutation:', mutation, error);
        failedQueue.push(mutation); // Keep it in queue if it failed due to server error
      } else {
        successCount++;
      }
    } catch (e) {
      console.error('Exception syncing mutation:', mutation, e);
      failedQueue.push(mutation);
    }
  }

  // Update queue with only failed items
  if (failedQueue.length === 0) {
    clearOfflineQueue();
    toast.success(`Successfully synced ${successCount} offline changes!`, { id: 'sync-toast' });
  } else {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(failedQueue));
    window.dispatchEvent(new Event('offline-queue-updated'));
    toast.error(`${failedQueue.length} changes failed to sync. Will retry later.`, { id: 'sync-toast' });
  }
}

// Function to setup global listeners
export function setupOfflineListeners() {
  window.addEventListener('online', () => {
    processOfflineQueue();
  });
}

// Function to recover dirty records that failed to enter the queue due to previous bugs
export async function syncOrphanedDirtyRecords(db: any) {
  try {
    const dirtyRecords = await db.records.filter((r: any) => r.is_dirty && !r.deleted_locally).toArray();
    if (dirtyRecords.length === 0) return;

    const queue = getOfflineQueue();
    let recoveredCount = 0;

    for (const record of dirtyRecords) {
      // Check if this record is already in the queue to avoid duplicates
      const inQueue = queue.some(m => m.action === 'INSERT' && m.payload.id === record.id);
      if (!inQueue) {
        // Remove internal fields before sending to Supabase
        const { is_dirty, deleted_locally, file_image, file_images, ...safeRecord } = record;
        // It's orphaned, add it to the queue
        addToOfflineQueue('file_tracking_records', 'INSERT', safeRecord);
        recoveredCount++;
      }
    }

    if (recoveredCount > 0) {
      console.log(`Recovered ${recoveredCount} orphaned records into the sync queue.`);
      processOfflineQueue(); // Trigger sync
    }
  } catch (err) {
    console.error("Error recovering orphaned records:", err);
  }
}

