// Node.js SQLite driver using better-sqlite3
// Thin wrapper around shared factory with Node-specific adapter

import type { CreateSqliteDriver } from "@evolu/common";
import Database from "better-sqlite3";
import type { PlatformIO } from "./PlatformIO";
import { createSqliteDriver } from "./SqliteDriverFactory";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodeDatabase = any;

export const createPersistentSqliteDriver = (
  io: PlatformIO,
): CreateSqliteDriver => {
  const nodeAdapter = {
    loadDatabase: (existingData: Uint8Array | null, memory?: boolean) => {
      if (existingData && !memory) {
        // better-sqlite3 accepts Buffer directly
        return new Database(Buffer.from(existingData)) as NodeDatabase;
      }
      return new Database(":memory:") as NodeDatabase;
    },
    logPrefix: "[db:sqlite:node",
    errorType: "DbDeserializeFailed",
  };

  return createSqliteDriver(io, nodeAdapter);
};
