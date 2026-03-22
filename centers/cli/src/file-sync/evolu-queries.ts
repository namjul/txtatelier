
import * as Evolu from "@evolu/common";
import type { TimestampBytes } from "@evolu/common/local-first";
import type { FileId, FilePath, Schema } from "./evolu-schema";

type EvoluDatabase = Evolu.Evolu<typeof Schema>;

export const createAllFilesQuery = (evolu: EvoluDatabase) =>
  evolu.createQuery((db) =>
    db
      .selectFrom("file")
      .selectAll()
      .where("isDeleted", "is not", Evolu.sqliteTrue)
      .where("path", "is not", null)
      .where("contentHash", "is not", null)
      .$narrowType<{ path: Evolu.kysely.NotNull; contentHash: Evolu.kysely.NotNull }>(),
  );

export type FileRow = Evolu.InferRow<ReturnType<typeof createAllFilesQuery>>;

export const createLatestHistoryQuery = (evolu: EvoluDatabase) =>
  evolu.createQuery((db) =>
    db
      .selectFrom("evolu_history")
      .select(["timestamp"])
      .where("table", "==", "file")
      .orderBy("timestamp", "desc")
      .limit(1),
  );


export const createChangedFilesQuery = (evolu: EvoluDatabase, contentChangeIds: FileId[]) =>
  evolu.createQuery((db) =>
    db
      .selectFrom("file")
      .selectAll()
      .where("id", "in", contentChangeIds)
      .where("path", "is not", null)
      .where("contentHash", "is not", null)
      .where("isDeleted", "is not", Evolu.sqliteTrue)
      .$narrowType<{ path: Evolu.kysely.NotNull; contentHash: Evolu.kysely.NotNull }>(),
  )

export const createFielsFromPathQuery = (evolu: EvoluDatabase, path: FilePath) => evolu.createQuery((db) =>
  db.selectFrom("file")
    .select(["id", "contentHash"])
    .where("path", "==", path)
    .where("isDeleted", "is not", Evolu.sqliteTrue),
);

export const createSyncStateQuery = (evolu: EvoluDatabase, path: FilePath) =>
  evolu.createQuery((db) =>
    db
      .selectFrom("_syncState")
      .select(["lastAppliedHash"])
      .where("path", "==", path),
  );

export const createHistoryCursorQuery = (evolu: EvoluDatabase) => {
  const cursorId = Evolu.createIdFromString<"HistoryCursor">("history-cursor");
  return evolu.createQuery((db) =>
    db
      .selectFrom("_historyCursor")
      .select(["lastTimestamp"])
      .where("id", "=", cursorId)
      .where("isDeleted", "is", null)
      .limit(1),
  );
};

export const createHistoryChangesQuery = (
  evolu: EvoluDatabase,
  cursor: TimestampBytes | null,
) =>
  evolu.createQuery((db) => {
    let qb = db
      .selectFrom("evolu_history")
      .select(["id", "timestamp", "column"])
      .where("table", "==", "file")
      .where("column", "in", ["content", "isDeleted"]);

    if (cursor != null) {
      qb = qb.where("timestamp", ">", cursor);
    }

    return qb.orderBy("timestamp", "asc");
  });

export const createDeletedFilesWithIdsQuery = (
  evolu: EvoluDatabase,
  deletionEventIds: FileId[],
) =>
  evolu.createQuery((db) =>
    db
      .selectFrom("file")
      .select(["id", "path"])
      .where("id", "in", deletionEventIds)
      .where("isDeleted", "is", Evolu.sqliteTrue)
      .$narrowType<{ path: Evolu.kysely.NotNull  }>(),
  );

export const createExistingPathsQuery = (evolu: EvoluDatabase) =>
  evolu.createQuery((db) =>
    db
      .selectFrom("file")
      .select(["path"])
      .where("isDeleted", "is not", Evolu.sqliteTrue)
      .$narrowType<{ path: Evolu.kysely.NotNull  }>(),
  );

export const createDeletedPathsQuery = (evolu: EvoluDatabase) =>
  evolu.createQuery((db) =>
    db
      .selectFrom("file")
      .select(["path"])
      .where("isDeleted", "is", Evolu.sqliteTrue)
      .$narrowType<{ path: Evolu.kysely.NotNull  }>(),
  );
