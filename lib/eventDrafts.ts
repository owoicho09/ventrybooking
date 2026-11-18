'use client';

/**
 * Create Event drafts, kept in two places:
 *  - this browser: the form JSON in localStorage and the picked images in
 *    IndexedDB, so a refresh, a tab the phone killed while the gallery was
 *    open, or a sign-out never loses work on this device;
 *  - the server (event_drafts, 059): the form JSON only, so the organiser can
 *    carry on from another device (re-adding images there).
 * Every storage call is wrapped: private mode or blocked storage just means
 * the device copy is skipped.
 */

const LS_PREFIX = 'ventry_event_draft:';
const DB_NAME = 'ventry_event_drafts';
const STORE = 'files';

export interface LocalDraft<T> {
  id: string;
  name: string;
  data: T;
  updatedAt: string;
}

export function newDraftId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // RFC4122 v4 fallback for older browsers.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function saveLocalDraft<T>(draft: LocalDraft<T>): boolean {
  try {
    localStorage.setItem(LS_PREFIX + draft.id, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function loadLocalDraft<T>(id: string): LocalDraft<T> | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + id);
    return raw ? (JSON.parse(raw) as LocalDraft<T>) : null;
  } catch {
    return null;
  }
}

export function listLocalDrafts(): { id: string; name: string; updatedAt: string }[] {
  const out: { id: string; name: string; updatedAt: string }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(LS_PREFIX)) continue;
      try {
        const d = JSON.parse(localStorage.getItem(key) ?? '') as LocalDraft<unknown>;
        if (d?.id) out.push({ id: d.id, name: d.name ?? '', updatedAt: d.updatedAt ?? '' });
      } catch { /* corrupt entry */ }
    }
  } catch { /* storage off */ }
  return out;
}

export function removeLocalDraft(id: string) {
  try { localStorage.removeItem(LS_PREFIX + id); } catch { /* storage off */ }
  void clearDraftFiles(id);
}

// ── Images (IndexedDB) ───────────────────────────────────────

function openDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

interface StoredFile { blob: Blob; name: string; type: string; lastModified: number }

/** Save (or with `file` null, remove) one picked image for a draft. */
export async function putDraftFile(draftId: string, slot: string, file: File | null): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const key = `${draftId}:${slot}`;
      if (file) {
        const v: StoredFile = { blob: file, name: file.name, type: file.type, lastModified: file.lastModified };
        tx.objectStore(STORE).put(v, key);
      } else {
        tx.objectStore(STORE).delete(key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

/** Every image saved for a draft, keyed by slot. */
export async function getDraftFiles(draftId: string): Promise<Record<string, File>> {
  const db = await openDb();
  if (!db) return {};
  const out: Record<string, File> = {};
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const range = IDBKeyRange.bound(`${draftId}:`, `${draftId}:￿`);
      const req = tx.objectStore(STORE).openCursor(range);
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return resolve();
        const v = cur.value as StoredFile;
        const slot = String(cur.key).slice(draftId.length + 1);
        try {
          out[slot] = new File([v.blob], v.name, { type: v.type, lastModified: v.lastModified });
        } catch { /* File constructor unsupported */ }
        cur.continue();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
  return out;
}

export async function clearDraftFiles(draftId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(IDBKeyRange.bound(`${draftId}:`, `${draftId}:￿`));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}
