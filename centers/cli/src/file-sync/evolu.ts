// Evolu client creation and management with module-level caching

import fs from "node:fs/promises";
import { dirname } from "node:path";
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
import { deriveShardOwner, type ShardOwner } from "@evolu/common/local-first";
import { FILES_SHARD } from "@txtatelier/sync-invariants";
import { logger } from "../logger";
import type { FlushError } from "./errors";
import { Schema } from "./evolu-schema";

type EvoluDatabase = Evolu<typeof Schema>;

import { createEvoluDeps } from "./platform/EvoluDeps";
import { createPlatformIO } from "./platform/PlatformIO";

// Module-level cache to prevent WebSocket leaks on reload
// (Evolu doesn't properly dispose WebSocket connections in 7.4.1)
let _cached: {
  evolu: EvoluDatabase;
  flush: () => Promise<Result<void, FlushError>>;
  owner: AppOwner;
  filesShardOwner: ShardOwner;
} | null = null;

export const createEvoluClient = async ({
  dbPath,
  relayUrl,
  forceNew = false,
  subscribeFilesShard = true,
}: {
  dbPath: string;
  relayUrl: string;
  forceNew?: boolean;
  /**
   * When false, do not register the files shard with sync transports (no relay WebSocket).
   * Use for one-shot `owner` CLI commands so the process can exit. Default true for sync.
   */
  subscribeFilesShard?: boolean;
}) => {
  if (_cached && !forceNew) {
    return _cached;
  }

  // Ensure directory exists
  await fs.mkdir(dirname(dbPath), { recursive: true });

  const io = createPlatformIO(dbPath);
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

  const deps = createEvoluDeps(io);

  const evolu = createEvolu(deps)(Schema, {
    name: SimpleName.orThrow("txtatelier"),
    transports: [{ type: "WebSocket", url: relayUrl }],
  });

  evolu.subscribeError(() => {
    const error = evolu.getError();
    if (error != null) {
      logger.error("[txtatelier] Evolu error:", error);
    }
  });

  // Get owner (Evolu handles persistence internally)
  const owner = await evolu.appOwner;

  const filesShardOwner = deriveShardOwner(owner, FILES_SHARD);
  if (subscribeFilesShard) {
    evolu.useOwner(filesShardOwner);
  }

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

  if (subscribeFilesShard) {
    _cached = { evolu, flush, owner, filesShardOwner };
    return _cached;
  }

  return { evolu, flush, owner, filesShardOwner };
};

export const resetEvolu = async (dbPath: string, relayUrl: string) => {
  if (_cached) {
    const flushResult = await _cached.flush();
    if (!flushResult.ok) {
      logger.error("[txtatelier] Failed to flush database:", flushResult.error);
    }
  }
  _cached = null;
  // This will generate a new owner on next createEvoluClient call
  return createEvoluClient({ dbPath, relayUrl, forceNew: true });
};
