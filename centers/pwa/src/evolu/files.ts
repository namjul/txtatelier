import { type kysely, sqliteTrue } from "@evolu/common";
import { evolu } from "./client";

export const filesQuery = evolu.createQuery((db) =>
  db
    .selectFrom("file")
    .select(["id", "path", "content", "contentHash", "updatedAt", "ownerId"])
    .where("isDeleted", "is not", sqliteTrue)
    .where("path", "is not", null)
    .where("contentHash", "is not", null)
    .$narrowType<{ path: kysely.NotNull; contentHash: kysely.NotNull }>()
    .orderBy("path"),
);

export type FilesRow = typeof filesQuery.Row;
