/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { precacheAndRoute } from "workbox-precaching";
import {
  PENDING_SHARE_DB_NAME,
  PENDING_SHARE_DB_VERSION,
  PENDING_SHARE_KEY,
  PENDING_SHARE_MESSAGE_TYPE,
  PENDING_SHARE_STORE,
  type PendingShareRecord,
} from "./share-target/constants";

const notifyClientsPendingShare = async (): Promise<void> => {
  const list = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: false,
  });
  for (const client of list) {
    client.postMessage({ type: PENDING_SHARE_MESSAGE_TYPE });
  }
};

declare const self: ServiceWorkerGlobalScope;
declare const __WB_MANIFEST: Array<{ url: string; revision: string | null }>;

const openPendingDb = (): Promise<IDBDatabase> =>
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

const putPendingShare = async (record: PendingShareRecord): Promise<void> => {
  const db = await openPendingDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PENDING_SHARE_STORE, "readwrite");
      tx.oncomplete = (): void => {
        resolve();
      };
      tx.onerror = (): void => {
        reject(tx.error ?? new Error("IndexedDB transaction failed"));
      };
      tx.objectStore(PENDING_SHARE_STORE).put(record, PENDING_SHARE_KEY);
    });
  } finally {
    db.close();
  }
};

const extractSharedPlainText = (formData: FormData): string => {
  const text = String(formData.get("text") ?? "").trim();
  if (text.length > 0) return text;
  const url = String(formData.get("url") ?? "").trim();
  if (url.length > 0) return url;
  const title = String(formData.get("title") ?? "").trim();
  return title;
};

const shareTargetPathname = (): string =>
  new URL("share-target", self.registration.scope).pathname;

const pathnameMatchesShareTarget = (pathname: string): boolean => {
  const expected = shareTargetPathname();
  const n = pathname.replace(/\/+$/, "") || "/";
  const e = expected.replace(/\/+$/, "") || "/";
  return n === e;
};

// Run before Workbox so POST /share-target is never left to the precache router/network.
self.addEventListener("fetch", (event: FetchEvent) => {
  if (event.request.method !== "POST") return;

  const url = new URL(event.request.url);
  if (!pathnameMatchesShareTarget(url.pathname)) return;

  event.respondWith(
    (async (): Promise<Response> => {
      const redirectTarget = new URL("./", self.registration.scope).href;

      try {
        const formData = await event.request.formData();
        const content = extractSharedPlainText(formData);
        if (content.length > 0) {
          await putPendingShare({
            content,
            timestamp: Date.now(),
          });
          await notifyClientsPendingShare();
        }
      } catch {
        // Malformed body or IDB failure: still land the user in the app
      }

      return Response.redirect(redirectTarget, 303);
    })(),
  );
});

precacheAndRoute(self.__WB_MANIFEST);
void self.skipWaiting();
void clientsClaim();
