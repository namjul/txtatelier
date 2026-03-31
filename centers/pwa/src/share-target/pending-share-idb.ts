import {
  PENDING_SHARE_DB_NAME,
  PENDING_SHARE_DB_VERSION,
  PENDING_SHARE_KEY,
  PENDING_SHARE_STORE,
  type PendingShareRecord,
} from "./constants";

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(PENDING_SHARE_DB_NAME, PENDING_SHARE_DB_VERSION);
    req.onerror = (): void => {
      reject(req.error ?? new Error("IndexedDB open failed"));
    };
    req.onupgradeneeded = (): void => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PENDING_SHARE_STORE)) {
        db.createObjectStore(PENDING_SHARE_STORE);
      }
    };
    req.onsuccess = (): void => {
      resolve(req.result);
    };
  });

export const getPendingShare = async (): Promise<PendingShareRecord | null> => {
  const db = await openDb();
  try {
    return await new Promise<PendingShareRecord | null>((resolve, reject) => {
      const tx = db.transaction(PENDING_SHARE_STORE, "readonly");
      const reqGet = tx.objectStore(PENDING_SHARE_STORE).get(PENDING_SHARE_KEY);
      reqGet.onerror = (): void => {
        reject(reqGet.error ?? new Error("IndexedDB get failed"));
      };
      reqGet.onsuccess = (): void => {
        const v = reqGet.result as PendingShareRecord | undefined;
        resolve(v ?? null);
      };
    });
  } finally {
    db.close();
  }
};

export const deletePendingShare = async (): Promise<void> => {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PENDING_SHARE_STORE, "readwrite");
      tx.oncomplete = (): void => {
        resolve();
      };
      tx.onerror = (): void => {
        reject(tx.error ?? new Error("IndexedDB transaction failed"));
      };
      tx.objectStore(PENDING_SHARE_STORE).delete(PENDING_SHARE_KEY);
    });
  } finally {
    db.close();
  }
};
