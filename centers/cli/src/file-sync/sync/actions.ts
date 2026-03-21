// Sync action types representing all sync operations as discriminated unions
// Actions are pure data - no side effects, just descriptions of what to do

/**
 * Filesystem operations (disk I/O)
 */
export type FileSystemAction =
  | WriteFileAction
  | DeleteFileAction
  | CreateConflictAction;

export interface WriteFileAction {
  readonly type: "WRITE_FILE";
  readonly path: string;
  readonly content: string;
  readonly hash: string;
}

export interface DeleteFileAction {
  readonly type: "DELETE_FILE";
  readonly path: string;
}

export interface CreateConflictAction {
  readonly type: "CREATE_CONFLICT";
  readonly originalPath: string;
  readonly conflictPath: string;
  readonly content: string;
  readonly ownerId: string;
}

/**
 * Evolu database operations
 */
export type EvoluAction =
  | InsertEvoluAction
  | UpdateEvoluAction
  | MarkDeletedEvoluAction;

export interface InsertEvoluAction {
  readonly type: "INSERT_EVOLU";
  readonly path: string;
  readonly content: string;
  readonly hash: string;
}

export interface UpdateEvoluAction {
  readonly type: "UPDATE_EVOLU";
  readonly id: string;
  readonly path: string;
  readonly content: string;
  readonly hash: string;
}

export interface MarkDeletedEvoluAction {
  readonly type: "MARK_DELETED_EVOLU";
  readonly id: string;
  readonly path: string;
}

/**
 * State tracking operations
 */
export type StateAction = SetTrackedHashAction | ClearTrackedHashAction;

export interface SetTrackedHashAction {
  readonly type: "SET_TRACKED_HASH";
  readonly path: string;
  readonly hash: string;
}

export interface ClearTrackedHashAction {
  readonly type: "CLEAR_TRACKED_HASH";
  readonly path: string;
}

/**
 * Meta operations (logging, skipping)
 */
export type MetaAction = SkipAction | LogAction;

export interface SkipAction {
  readonly type: "SKIP";
  readonly reason: string;
  readonly path: string;
}

export interface LogAction {
  readonly type: "LOG";
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
}

/**
 * Union of all sync actions
 */
export type SyncAction =
  | FileSystemAction
  | EvoluAction
  | StateAction
  | MetaAction;

/**
 * Helper functions for creating actions (optional, for ergonomics)
 */

export const writeFile = (
  path: string,
  content: string,
  hash: string,
): WriteFileAction => ({
  type: "WRITE_FILE",
  path,
  content,
  hash,
});

export const deleteFile = (path: string): DeleteFileAction => ({
  type: "DELETE_FILE",
  path,
});

export const createConflict = (
  originalPath: string,
  conflictPath: string,
  content: string,
  ownerId: string,
): CreateConflictAction => ({
  type: "CREATE_CONFLICT",
  originalPath,
  conflictPath,
  content,
  ownerId,
});

export const insertEvolu = (
  path: string,
  content: string,
  hash: string,
): InsertEvoluAction => ({
  type: "INSERT_EVOLU",
  path,
  content,
  hash,
});

export const updateEvolu = (
  id: string,
  path: string,
  content: string,
  hash: string,
): UpdateEvoluAction => ({
  type: "UPDATE_EVOLU",
  id,
  path,
  content,
  hash,
});

export const markDeletedEvolu = (
  id: string,
  path: string,
): MarkDeletedEvoluAction => ({
  type: "MARK_DELETED_EVOLU",
  id,
  path,
});

export const setTrackedHash = (
  path: string,
  hash: string,
): SetTrackedHashAction => ({
  type: "SET_TRACKED_HASH",
  path,
  hash,
});

export const clearTrackedHash = (path: string): ClearTrackedHashAction => ({
  type: "CLEAR_TRACKED_HASH",
  path,
});

export const skip = (reason: string, path: string): SkipAction => ({
  type: "SKIP",
  reason,
  path,
});

export const log = (
  level: "debug" | "info" | "warn" | "error",
  message: string,
): LogAction => ({
  type: "LOG",
  level,
  message,
});
