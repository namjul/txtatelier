import { NonEmptyString1000, type kysely, sqliteTrue } from "@evolu/common";
import { evolu } from "./client";

export const createFileRowByPathQuery = (path: string) => {
  const pathValue = NonEmptyString1000.orThrow(path);
  return evolu.createQuery((db) =>
    db
      .selectFrom("file")
      .select(["id", "path", "content", "contentHash", "updatedAt", "ownerId"])
      .where("isDeleted", "is not", sqliteTrue)
      .where("path", "=", pathValue)
      .where("path", "is not", null)
      .where("contentHash", "is not", null)
      .$narrowType<{ path: kysely.NotNull; contentHash: kysely.NotNull }>()
      .limit(1),
  );
};
