// Bidirectional filesystem sync with Evolu
// Phase 0: Change Capture (Filesystem → Evolu)
// Phase 1: State Materialization (Evolu → Filesystem)

import { homedir } from "node:os";
import { join } from "node:path";
import envPaths from "env-paths";
import {
  createFormatTypeError,
  Mnemonic,
  tryAsync,
  type AppOwner,
  type Evolu,
  type Result,
} from "@evolu/common";
import { logger } from "../logger";
import { createEvoluClient } from "./evolu";
import {
  captureChange,
  reconcileStartupFilesystemState,
  startStateMaterialization,
} from "./sync/index";
import { startWatching } from "./watch";
import type { Schema } from "./schema";
import type { FlushError } from "./errors";

const paths = envPaths("txtatelier");

const formatTypeError = createFormatTypeError();

export const defaultDbPath = join(paths.data, "txtatelier.db");
export const defaultRelayUrl = "wss://free.evoluhq.com";
export const defaultWatchDir = join(homedir(), "Documents", "Txtatelier");

export interface FileSyncConfig {
  readonly dbPath: string;
  readonly watchDir: string;
  readonly relayUrl: string,
}

export interface FileSyncSession {
  readonly stop: () => Promise<void>;
  readonly evolu: Evolu<typeof Schema>;
  readonly flush: () => Promise<Result<void, FlushError>>;
  readonly owner: AppOwner;
  readonly config: FileSyncConfig;
}

export const startFileSync = async (
  config?: Partial<FileSyncConfig>,
  restoreMnemonic?: Mnemonic
): Promise<FileSyncSession> => {
  logger.log("[file-sync] Initializing...");

  const resolvedWatchDir = config?.watchDir ?? defaultWatchDir;
  const resolvedDbPath = config?.dbPath ?? defaultDbPath;
  const resolvedrelayUrl = config?.relayUrl ?? defaultRelayUrl;

  // Create Evolu client (handles owner persistence internally)
  const client = await createEvoluClient({
    dbPath: resolvedDbPath,
    relayUrl: resolvedrelayUrl,
  });
  const evolu = client.evolu;
  const owner = client.owner;
  const closeDb = client.flush;

  if (restoreMnemonic) {
    logger.log("[file-sync] Restoring from provided mnemonic...");

    const restoreResult = await tryAsync(
      () => evolu.restoreAppOwner(restoreMnemonic, { reload: false }),
      (error) => error as Error,
    );

    if (restoreResult.ok) {
      logger.log("[file-sync] Mnemonic restored to database");
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      logger.log("[file-sync] Flushing database...");

      const flushResult = await closeDb();
      if (!flushResult.ok) {
        logger.error(
          "[file-sync] Failed to flush restored mnemonic:",
          flushResult.error,
        );
      } else {
        logger.log("[file-sync] Mnemonic restore persisted");
      }
      logger.log("[file-sync] Restart required to activate restored owner");
      process.exit(flushResult.ok ? 0 : 1);
    } else {
      logger.warn(
        "[file-sync] Failed to restore mnemonic, using generated owner:",
        restoreResult.error,
      );
    }
  }

  // Detect first run (check if DB file exists)
  const isFirstRun = !(await Bun.file(resolvedDbPath).exists());

  if (isFirstRun && !restoreMnemonic) {
    logger.log("[file-sync]");
    logger.log("[file-sync] First run detected!");
    logger.log("[file-sync]");
    logger.log("[file-sync] Your mnemonic (save this securely!):");
    logger.log(`[file-sync]   ${owner.mnemonic}`);
    logger.log("[file-sync]");
    logger.log("[file-sync] ⚠️  IMPORTANT: Save this mnemonic!");
    logger.log(
      "[file-sync] ⚠️  You'll need it to access your data on other devices.",
    );
    logger.log("[file-sync] ⚠️  Run 'txtatelier owner show' to see it again.");
    logger.log("[file-sync]");
  }

  logger.log(`[file-sync] Owner ID: ${owner.id}`);

  // Subscribe to Evolu errors
  const unsubscribeError = evolu.subscribeError(() => {
    const error = evolu.getError();
    if (error) {
      logger.error("[file-sync] Evolu error:", error);
    }
  });

  // Phase 5 startup reconciliation: reflect pre-existing filesystem files into
  // Evolu before both loops start, now that watcher ignores initial events.
  await reconcileStartupFilesystemState(evolu, resolvedWatchDir);

  // Start Change Capture: watch filesystem and reflect into Evolu
  logger.log(`[file-sync] Watching directory: ${resolvedWatchDir}`);
  const stopWatching = await startWatching(
    resolvedWatchDir,
    async (filePath) => {
      await captureChange(evolu, resolvedWatchDir, filePath);
    },
  );

  // Start State Materialization: apply replicated rows to filesystem
  const stopSyncing = startStateMaterialization(evolu, resolvedWatchDir, {
    onConflictArtifactCreated: async (conflictPath: string) => {
      await captureChange(evolu, resolvedWatchDir, conflictPath);
    },
  });

  logger.log("[file-sync] Ready");

  // Return session with bundled cleanup
  return {
    evolu,
    owner,
    flush: client.flush,
    config: {
      dbPath: resolvedDbPath,
      watchDir: resolvedWatchDir,
      relayUrl: resolvedrelayUrl
    },
    stop: async (): Promise<void> => {
      logger.log("[file-sync] Shutting down...");

      // Unsubscribe from error handler
      if (unsubscribeError) {
        unsubscribeError();
      }

      // Stop State Materialization first (stop listening to Evolu)
      if (stopSyncing) {
        stopSyncing();
      }

      // Stop Change Capture (stop watching filesystem)
      if (stopWatching) {
        stopWatching();
      }

      // Flush database
      if (closeDb) {
        const flushResult = await closeDb();
        if (!flushResult.ok) {
          logger.error(
            "[file-sync] Failed to flush database:",
            flushResult.error,
          );
        }
      }

      logger.log("[file-sync] Stopped");
    },
  };
};

export const showOwnerMnemonic = async (session: FileSyncSession): Promise<void> => {
  console.log(session.owner.mnemonic);
};

export const showOwnerContext = async (session: FileSyncSession): Promise<void> => {

  console.log("Active context:");
  console.log(`  DB path: ${session.config.dbPath}`);
  console.log(`  Watch dir: ${session.config.watchDir}`);
  console.log(`  Relay URL: ${session.config.relayUrl}`);
  console.log(`  Owner ID: ${session.owner.id}`);
};

export const restoreOwnerFromMnemonic = async (
  session: FileSyncSession,
  mnemonicInput: string,
): Promise<void> => {
  const parsedMnemonic = Mnemonic.from(mnemonicInput.trim());

  if (!parsedMnemonic.ok) {
    throw new Error(
      `Invalid mnemonic: ${formatTypeError(parsedMnemonic.error)}`,
    );
  }

  await session.evolu.restoreAppOwner(parsedMnemonic.value, { reload: false });

  const flushResult = await session.flush();
  if (!flushResult.ok) {
    throw new Error("Failed to flush restored owner", {
      cause: flushResult.error,
    });
  }

  logger.log("Owner restored.");
  logger.log("Restart required to activate restored owner.");
};

export const resetOwner = async (session: FileSyncSession,): Promise<void> => {
  await session.evolu.resetAppOwner({ reload: false });

  const flushResult = await session.flush();
  if (!flushResult.ok) {
    throw new Error("Failed to flush reset owner", {
      cause: flushResult.error,
    });
  }

  logger.log("Owner reset.");
  logger.log("Restart required to activate new owner.");
};

export type { Schema } from "./schema";
