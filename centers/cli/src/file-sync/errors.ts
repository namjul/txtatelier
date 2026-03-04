export type ReadDbError = {
  readonly type: "DbReadFailed";
  readonly dbPath: string;
  readonly cause: unknown;
};

export type DbDeserializeError = {
  readonly type: "DbDeserializeFailed";
  readonly cause: unknown;
};

export type WriteDbError = {
  readonly type: "DbWriteFailed";
  readonly dbPath: string;
  readonly cause: unknown;
};

export type FlushError =
  | {
      readonly type: "DbExportFailed";
      readonly cause: unknown;
    }
  | {
      readonly type: "DbFlushWriteFailed";
      readonly dbPath: string;
      readonly cause: unknown;
    };

export type ChangeCaptureError =
  | {
      readonly type: "FileStatFailed";
      readonly absolutePath: string;
      readonly cause: unknown;
    }
  | {
      readonly type: "FileReadFailed";
      readonly absolutePath: string;
      readonly cause: unknown;
    }
  | {
      readonly type: "FileHashFailed";
      readonly absolutePath: string;
      readonly cause: unknown;
    }
  | {
      readonly type: "EvoluQueryFailed";
      readonly relativePath: string;
      readonly cause: unknown;
    }
  | {
      readonly type: "EvoluMutationFailed";
      readonly relativePath: string;
      readonly cause: unknown;
    };

export type StateMaterializationError =
  | {
      readonly type: "StateListReadFailed";
      readonly cause: unknown;
    }
  | {
      readonly type: "StateReadFailed";
      readonly path: string;
      readonly cause: unknown;
    }
  | {
      readonly type: "DiskHashFailed";
      readonly absolutePath: string;
      readonly cause: unknown;
    }
  | {
      readonly type: "ConflictFileCreateFailed";
      readonly absolutePath: string;
      readonly cause: unknown;
    }
  | {
      readonly type: "FileWriteFailed";
      readonly absolutePath: string;
      readonly cause: unknown;
    }
  | {
      readonly type: "FileDeleteFailed";
      readonly absolutePath: string;
      readonly cause: unknown;
    }
  | {
      readonly type: "StateWriteFailed";
      readonly path: string;
      readonly cause: unknown;
    };

export type SyncLoopAError = ChangeCaptureError;
export type SyncLoopBError = StateMaterializationError;

export type WatchQueueTaskError = {
  readonly type: "WatchQueueTaskFailed";
  readonly path: string;
  readonly cause: unknown;
};

export type WatchShutdownError = {
  readonly type: "WatchCloseFailed";
  readonly cause: unknown;
};
