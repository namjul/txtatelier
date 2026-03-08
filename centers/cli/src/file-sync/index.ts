// Bidirectional filesystem sync with Evolu
// Phase 0: Change Capture (Filesystem → Evolu)
// Phase 1: State Materialization (Evolu → Filesystem)

import {
  createFormatTypeError,
  Mnemonic,
  tryAsync,
} from "@evolu/common";
import { defaultWatchDir, env } from "../env";
import { logger } from "../logger";
import { createEvoluClient } from "./evolu";
import {
  captureChange,
  reconcileStartupFilesystemState,
  startStateMaterialization,
} from "./sync/index";
import { startWatching } from "./watch";

const formatTypeError = createFormatTypeError();

export interface FileSyncSession {
  readonly stop: () => Promise<void>;
}

export const startFileSync = async (
  watchDir?: string,
): Promise<FileSyncSession> => {
  logger.log("[file-sync] Initializing...");

  const resolvedWatchDir = watchDir ?? defaultWatchDir;

  // Create Evolu client (handles owner persistence internally)
  const client = await createEvoluClient({
    dbPath: env.dbPath,
    relayUrl: env.relayUrl,
  });
  const evolu = client.evolu;
  const owner = client.owner;
  const closeDb = client.flush;

  const restoreMnemonic = env.mnemonic;
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
  const isFirstRun = !(await Bun.file(env.dbPath).exists());

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

export const showOwnerMnemonic = async (): Promise<void> => {
  const client = await createEvoluClient({
    dbPath: env.dbPath,
    relayUrl: env.relayUrl,
  });
  const owner = client.owner;

  console.log(owner.mnemonic);
};

export const showOwnerContext = async (): Promise<void> => {
  const client = await createEvoluClient({
    dbPath: env.dbPath,
    relayUrl: env.relayUrl,
  });
  const owner = client.owner;

  console.log("Active context:");
  console.log(`  DB path: ${env.dbPath}`);
  console.log(`  Watch dir: ${defaultWatchDir}`);
  console.log(`  Owner ID: ${owner.id}`);
};

export const restoreOwnerFromMnemonic = async (
  mnemonicInput: string,
): Promise<void> => {
  const parsedMnemonic = Mnemonic.from(mnemonicInput.trim());

  if (!parsedMnemonic.ok) {
    throw new Error(
      `Invalid mnemonic: ${formatTypeError(parsedMnemonic.error)}`,
    );
  }

  const client = await createEvoluClient({
    dbPath: env.dbPath,
    relayUrl: env.relayUrl,
  });

  await client.evolu.restoreAppOwner(parsedMnemonic.value, { reload: false });

  const flushResult = await client.flush();
  if (!flushResult.ok) {
    throw new Error("Failed to flush restored owner", {
      cause: flushResult.error,
    });
  }

  logger.log("Owner restored.");
  logger.log("Restart required to activate restored owner.");
};

export const resetOwner = async (): Promise<void> => {
  const client = await createEvoluClient({
    dbPath: env.dbPath,
    relayUrl: env.relayUrl,
  });

  await client.evolu.resetAppOwner({ reload: false });

  const flushResult = await client.flush();
  if (!flushResult.ok) {
    throw new Error("Failed to flush reset owner", {
      cause: flushResult.error,
    });
  }

  logger.log("Owner reset.");
  logger.log("Restart required to activate new owner.");
};

export type { Schema } from "./schema";
