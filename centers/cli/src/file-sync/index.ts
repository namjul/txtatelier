// Bidirectional filesystem sync with Evolu
// Phase 0: Change Capture (Filesystem → Evolu)
// Phase 1: State Materialization (Evolu → Filesystem)

import {
  type AppOwner,
  createFormatTypeError,
  type Evolu,
  Mnemonic,
  type Result,
  tryAsync,
} from "@evolu/common";
import { env } from "../env";
import { logger } from "../logger";
import type { FlushError } from "./errors";
import { createEvoluClient } from "./evolu";
import type { Schema } from "./schema";
import {
  captureChange,
  reconcileStartupFilesystemState,
  startStateMaterialization,
} from "./sync/index";
import { startWatching } from "./watch";

type EvoluDatabase = Evolu<typeof Schema>;

const formatTypeError = createFormatTypeError();

let evolu: EvoluDatabase;
let owner: AppOwner;
let closeDb: () => Promise<Result<void, FlushError>>;
let stopWatching: (() => void) | null = null;
let stopSyncing: (() => void) | null = null;
let unsubscribeError: (() => void) | null = null;

export const startFileSync = async (): Promise<void> => {
  logger.log("[file-sync] Initializing...");

  // Create Evolu client (handles owner persistence internally)
  const client = await createEvoluClient({
    dbPath: env.dbPath,
    relayUrl: env.relayUrl,
  });
  evolu = client.evolu;
  owner = client.owner;
  closeDb = client.flush;

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
  unsubscribeError = evolu.subscribeError(() => {
    const error = evolu.getError();
    if (error) {
      logger.error("[file-sync] Evolu error:", error);
    }
  });

  // Phase 5 startup reconciliation: reflect pre-existing filesystem files into
  // Evolu before both loops start, now that watcher ignores initial events.
  await reconcileStartupFilesystemState(evolu, env.watchDir);

  // Start Change Capture: watch filesystem and reflect into Evolu
  logger.log(`[file-sync] Watching directory: ${env.watchDir}`);
  stopWatching = await startWatching(env.watchDir, async (filePath) => {
    await captureChange(evolu, env.watchDir, filePath);
  });

  // Start State Materialization: apply replicated rows to filesystem
  stopSyncing = startStateMaterialization(evolu, env.watchDir, {
    onConflictArtifactCreated: async (conflictPath: string) => {
      await captureChange(evolu, env.watchDir, conflictPath);
    },
  });

  logger.log("[file-sync] Ready");
};

export const stopFileSync = async (): Promise<void> => {
  logger.log("[file-sync] Shutting down...");

  // Unsubscribe from error handler
  if (unsubscribeError) {
    unsubscribeError();
    unsubscribeError = null;
  }

  // Stop State Materialization first (stop listening to Evolu)
  if (stopSyncing) {
    stopSyncing();
    stopSyncing = null;
  }

  // Stop Change Capture (stop watching filesystem)
  if (stopWatching) {
    stopWatching();
    stopWatching = null;
  }

  // Flush database
  if (closeDb) {
    const flushResult = await closeDb();
    if (!flushResult.ok) {
      logger.error("[file-sync] Failed to flush database:", flushResult.error);
    }
  }

  logger.log("[file-sync] Stopped");
};

export const showOwnerMnemonic = async (): Promise<void> => {
  const client = await createEvoluClient({
    dbPath: env.dbPath,
    relayUrl: env.relayUrl,
  });
  owner = client.owner;

  console.log(owner.mnemonic);
};

export const showOwnerContext = async (): Promise<void> => {
  const client = await createEvoluClient({
    dbPath: env.dbPath,
    relayUrl: env.relayUrl,
  });
  owner = client.owner;

  console.log("Active context:");
  console.log(`  DB path: ${env.dbPath}`);
  console.log(`  Watch dir: ${env.watchDir}`);
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

  logger.log("Owner and local data reset.");
  logger.log("Restart required to initialize the new owner.");
};

export { evolu };
export type { Schema } from "./schema";
