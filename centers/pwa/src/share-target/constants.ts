/** IndexedDB bridge between share-target POST (service worker) and the app. */
export const PENDING_SHARE_MESSAGE_TYPE = "txtatelier:pending-share";

export const PENDING_SHARE_DB_NAME = "txtatelier-share-target";
export const PENDING_SHARE_DB_VERSION = 1;
export const PENDING_SHARE_STORE = "pending";
export const PENDING_SHARE_KEY = "pendingShare";

export type PendingShareRecord = {
  readonly content: string;
  readonly timestamp: number;
};
