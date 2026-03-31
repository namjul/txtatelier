import { type kysely, sqliteTrue } from "@evolu/common";
import { evolu } from "./client";

export const settingsQuery = evolu.createQuery((db) =>
  db
    .selectFrom("_settings")
    .select(["id", "inboxPath", "updatedAt", "ownerId"])
    .where("isDeleted", "is not", sqliteTrue)
    .where("inboxPath", "is not", null)
    .$narrowType<{ inboxPath: kysely.NotNull }>()
    .limit(1),
);

export type SettingsRow = typeof settingsQuery.Row;
