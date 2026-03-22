
import * as Evolu from "@evolu/common";
import type { FileId, Schema } from "./evolu-schema";

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
