// Idempotent Offline Sync Queue for Production Entries
// Never claims "Saved" before server confirmation; retries safely using the same client_submission_id.

const QUEUE_KEY = 'pha_pending_sync_queue_v2';

export function createSubmissionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sub-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getSyncQueue() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSyncQueue(items) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // Ignore quota errors
  }
}

export function enqueuePendingSubmission(payload, errorMessage = '') {
  const queue = getSyncQueue();
  const id = payload.client_submission_id || createSubmissionId();
  const item = {
    id,
    payload: { ...payload, client_submission_id: id },
    attempts: 1,
    lastError: errorMessage,
    createdAt: new Date().toISOString(),
    status: navigator?.onLine === false ? 'offline' : 'failed',
  };
  const filtered = queue.filter((q) => q.id !== id);
  filtered.push(item);
  saveSyncQueue(filtered);
  return item;
}

export function removeQueuedSubmission(id) {
  const queue = getSyncQueue().filter((q) => q.id !== id);
  saveSyncQueue(queue);
  return queue;
}

export async function flushSyncQueue(submitFn) {
  const queue = getSyncQueue();
  if (queue.length === 0) return { synced: 0, remaining: 0 };

  let synced = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      await submitFn(item.payload, { fromQueue: true });
      synced += 1;
    } catch (err) {
      remaining.push({
        ...item,
        attempts: (item.attempts || 0) + 1,
        lastError: err?.message || 'Sync retry failed',
        status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'failed',
      });
    }
  }

  saveSyncQueue(remaining);
  return { synced, remaining: remaining.length };
}
