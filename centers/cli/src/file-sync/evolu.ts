// Evolu client creation and management with module-level caching

import {
  type AppOwner,
  createEvolu,
  type Evolu,
  err,
  ok,
  type Result,
  SimpleName,
  tryAsync,
} from "@evolu/common";
import { logger } from "../logger";
import type { FlushError } from "./errors";
import { Schema } from "./schema";

type EvoluDatabase = Evolu<typeof Schema>;

import { createBunEvoluDeps } from "./platform/BunEvoluDeps";
import { createBunPlatformIO } from "./platform/PlatformIO";

// Module-level cache to prevent WebSocket leaks on reload
// (Evolu doesn't properly dispose WebSocket connections in 7.4.1)
let _cached: {
  evolu: EvoluDatabase;
  flush: () => Promise<Result<void, FlushError>>;
  owner: AppOwner;
} | null = null;

export const createEvoluClient = async ({
  dbPath,
  forceNew = false,
}: {
  dbPath: string;
  forceNew?: boolean;
}) => {
  if (_cached && !forceNew) {
    return _cached;
  }

  // Ensure directory exists
  const fs = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  await fs.mkdir(dirname(dbPath), { recursive: true });

  const io = createBunPlatformIO(dbPath);
  const readPreflightResult = await io.readFile();
  if (!readPreflightResult.ok) {
    logger.error(
      "[txtatelier] Database preflight read failed:",
      readPreflightResult.error,
    );
    throw new Error("Database preflight read failed", {
      cause: readPreflightResult.error,
    });
  }

  const deps = createBunEvoluDeps(io);

  const evolu = createEvolu(deps)(Schema, {
    name: SimpleName.orThrow("txtatelier"),
    // Phase 2: Enable Evolu sync via free test relay
    transports: [{ type: "WebSocket", url: "wss://free.evoluhq.com" }],
  });

  // Get owner (Evolu handles persistence internally)
  const owner = await evolu.appOwner;

  // Flush function - for now, just export and write the database
  const flush = async (): Promise<Result<void, FlushError>> => {
    const exportResult = await tryAsync(
      () => evolu.exportDatabase(),
      (cause): FlushError => ({
        type: "DbExportFailed",
        cause,
      }),
    );

    if (!exportResult.ok) {
      return err(exportResult.error);
    }

    const writeResult = await io.writeFile(exportResult.value);
    if (!writeResult.ok) {
      return err({
        type: "DbFlushWriteFailed",
        dbPath,
        cause: writeResult.error,
      });
    }

    return ok();
  };

  _cached = { evolu, flush, owner };

  return _cached;
};

export const resetEvolu = async (dbPath: string) => {
  if (_cached) {
    const flushResult = await _cached.flush();
    if (!flushResult.ok) {
      logger.error("[txtatelier] Failed to flush database:", flushResult.error);
    }
  }
  _cached = null;
  // This will generate a new owner on next createEvoluClient call
  return createEvoluClient({ dbPath, forceNew: true });
};
