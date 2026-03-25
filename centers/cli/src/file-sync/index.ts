// Bidirectional filesystem sync with Evolu
// Phase 0: Change Capture (Filesystem → Evolu)
// Phase 1: State Materialization (Evolu → Filesystem)

import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  type AppOwner,
  createFormatTypeError,
  type Evolu,
  err,
  Mnemonic,
  ok,
  type Result,
  tryAsync,
} from "@evolu/common";
import type { ShardOwner } from "@evolu/common/local-first";
import envPaths from "env-paths";
import { env } from "../env";
import { logger } from "../logger";
import type { FlushError } from "./errors";
import { createEvoluClient } from "./evolu";
import type { Schema } from "./evolu-schema";
import {
  captureChange,
  type FileSyncContext,
  type ReconcileFatalError,
  type ReconcileStats,
  reconcileStartupEvoluState,
  reconcileStartupFilesystemState,
  startStateMaterialization,
} from "./sync/index";
import { startWatching } from "./watch";

const paths = envPaths("txtatelier");

const formatTypeError = createFormatTypeError();

const hashWatchDir = (dir: string) =>
  createHash("sha256").update(resolve(dir)).digest("hex").slice(0, 8);

export const defaultDbPath = (watchDir: string) =>
  join(paths.data, `txtatelier-${hashWatchDir(watchDir)}.db`);
export const defaultRelayUrl = "wss://free.evoluhq.com";
export const defaultWatchDir = join(homedir(), "Documents", "Txtatelier");

export interface FileSyncConfig {
  readonly dbPath: string;
  readonly watchDir: string;
  readonly relayUrl: string;
}

/**
 * Fatal error during file sync startup.
 * Wraps reconciliation fatal errors.
 */
export type StartupFatalError = {
  readonly type: "StartupFailed";
  readonly cause: ReconcileFatalError;
};

export interface OwnerSession {
  readonly evolu: Evolu<typeof Schema>;
  readonly flush: () => Promise<Result<void, FlushError>>;
  readonly owner: AppOwner;
  readonly filesShardOwner: ShardOwner;
  readonly config: FileSyncConfig;
}

export interface FileSyncSession extends OwnerSession {
  readonly stop: () => Promise<void>;
  readonly failedSyncs: ReadonlySet<string>;
  readonly startupReconciliation: {
    readonly filesystem: ReconcileStats;
    readonly evolu: ReconcileStats;
  };
}

/**
 * Create a lightweight session for owner queries without starting sync.
 * Use this for commands that only need to read/modify owner information.
 */
export const createOwnerSession = async (
  config?: Partial<FileSyncConfig>,
): Promise<OwnerSession> => {
  const resolvedWatchDir = config?.watchDir ?? env.watchDir ?? defaultWatchDir;
  const resolvedDbPath =
    config?.dbPath ?? env.dbPath ?? defaultDbPath(resolvedWatchDir);
  const resolvedRelayUrl = config?.relayUrl ?? env.relayUrl ?? defaultRelayUrl;

  // Create Evolu client (handles owner persistence internally)
  const client = await createEvoluClient({
    dbPath: resolvedDbPath,
    relayUrl: resolvedRelayUrl,
  });

  return {
    evolu: client.evolu,
    owner: client.owner,
    filesShardOwner: client.filesShardOwner,
    flush: client.flush,
    config: {
      dbPath: resolvedDbPath,
      watchDir: resolvedWatchDir,
      relayUrl: resolvedRelayUrl,
    },
  };
};

export const startFileSync = async (
  config?: Partial<FileSyncConfig>,
  restoreMnemonic?: Mnemonic,
): Promise<Result<FileSyncSession, StartupFatalError>> => {
  logger.info("[lifecycle] Initializing...");

  // Create base owner session
  const ownerSession = await createOwnerSession(config);
  const { evolu, owner, filesShardOwner, flush: closeDb, config: resolvedConfig } = ownerSession;
  const resolvedWatchDir = resolvedConfig.watchDir;
  const resolvedDbPath = resolvedConfig.dbPath;
  const resolvedrelayUrl = resolvedConfig.relayUrl;

  const syncCtx: FileSyncContext = {
    evolu,
    watchDir: resolvedWatchDir,
    filesOwnerId: filesShardOwner.id,
  };

  if (restoreMnemonic) {
    logger.debug("[lifecycle] Restoring from provided mnemonic...");

    const restoreResult = await tryAsync(
      () => evolu.restoreAppOwner(restoreMnemonic, { reload: false }),
      (error) => error as Error,
    );

    if (restoreResult.ok) {
      logger.debug("[lifecycle] Mnemonic restored to database");
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      logger.debug("[lifecycle] Flushing database...");

      const flushResult = await closeDb();
      if (!flushResult.ok) {
        logger.error(
          "[error] Failed to flush restored mnemonic:",
          flushResult.error,
        );
      } else {
        logger.debug("[lifecycle] Mnemonic restore persisted");
      }
      logger.info("[lifecycle] Restart required to activate restored owner");
      process.exit(flushResult.ok ? 0 : 1);
    } else {
      logger.warn(
        "[lifecycle] Failed to restore mnemonic, using generated owner:",
        restoreResult.error,
      );
    }
  }

  // Detect first run (check if DB file exists)
  const isFirstRun = !(await access(resolvedDbPath).then(
    () => true,
    () => false,
  ));

  if (isFirstRun && !restoreMnemonic) {
    logger.info("[lifecycle]");
    logger.info("[lifecycle] First run detected!");
    logger.info("[lifecycle]");
    logger.info("[lifecycle] Your mnemonic (save this securely!):");
    logger.info(`[lifecycle]   ${owner.mnemonic}`);
    logger.info("[lifecycle]");
    logger.info("[lifecycle] ⚠️  IMPORTANT: Save this mnemonic!");
    logger.info(
      "[lifecycle] ⚠️  You'll need it to access your data on other devices.",
    );
    logger.info("[lifecycle] ⚠️  Run 'txtatelier owner show' to see it again.");
    logger.info("[lifecycle]");
  }

  logger.info(`[lifecycle] Owner ID: ${owner.id}`);

  // Subscribe to Evolu errors
  const unsubscribeError = evolu.subscribeError(() => {
    const error = evolu.getError();
    if (error) {
      logger.error("[error] Evolu error:", error);
    }
  });

  // Startup sync: apply any Evolu changes that happened while offline (deletions/additions)
  // This must run BEFORE filesystem reconciliation to prevent re-adding deleted files
  const evolResult = await reconcileStartupEvoluState(syncCtx);

  if (!evolResult.ok) {
    // Fatal error in Evolu reconciliation - cannot proceed
    logger.error(
      "[error] Fatal error during Evolu reconciliation:",
      evolResult.error,
    );
    return err({ type: "StartupFailed", cause: evolResult.error });
  }

  if (evolResult.value.failedCount > 0) {
    logger.warn(
      `[lifecycle] Evolu reconciliation completed with ${evolResult.value.failedCount} partial failures`,
    );
  }

  // Phase 5 startup reconciliation: reflect pre-existing filesystem files into
  // Evolu before both loops start, now that watcher ignores initial events.
  const fsResult = await reconcileStartupFilesystemState(syncCtx);

  if (!fsResult.ok) {
    // Fatal error in filesystem reconciliation - cannot proceed
    logger.error(
      "[error] Fatal error during filesystem reconciliation:",
      fsResult.error,
    );
    return err({ type: "StartupFailed", cause: fsResult.error });
  }

  if (fsResult.value.failedCount > 0) {
    logger.warn(
      `[lifecycle] Filesystem reconciliation completed with ${fsResult.value.failedCount} partial failures`,
    );
  }

  // Track failed sync operations for observability
  // Future: Expose via status command or error reporting
  const failedSyncs = new Set<string>();

  // Start Change Capture: watch filesystem and reflect into Evolu
  logger.info(`[lifecycle] Watching directory: ${resolvedWatchDir}`);
  const stopWatching = await startWatching(
    resolvedWatchDir,
    async (filePath) => {
      const result = await captureChange(syncCtx, filePath);
      if (!result.ok) {
        failedSyncs.add(filePath);
        logger.error(
          `[capture:fs→evolu] Failed to capture ${filePath}:`,
          result.error,
        );
      }
    },
  );

  // Start State Materialization: apply replicated rows to filesystem
  const stopSyncing = startStateMaterialization(syncCtx, {
    onConflictArtifactCreated: async (conflictPath: string) => {
      const result = await captureChange(syncCtx, conflictPath);
      if (!result.ok) {
        failedSyncs.add(conflictPath);
        logger.error(
          `[capture:fs→evolu] Failed to capture conflict file ${conflictPath}:`,
          result.error,
        );
      }
    },
  });

  logger.info("[lifecycle] Ready");

  // Return session with bundled cleanup
  return ok({
    evolu,
    owner,
    filesShardOwner,
    flush: closeDb,
    failedSyncs,
    startupReconciliation: {
      filesystem: fsResult.value,
      evolu: evolResult.value,
    },
    config: {
      dbPath: resolvedDbPath,
      watchDir: resolvedWatchDir,
      relayUrl: resolvedrelayUrl,
    },
    stop: async (): Promise<void> => {
      logger.info("[lifecycle] Shutting down...");

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
          logger.error("[error] Failed to flush database:", flushResult.error);
        }
      }

      logger.info("[lifecycle] Stopped");
    },
  });
};

export const showOwnerMnemonic = async (
  session: OwnerSession,
): Promise<void> => {
  console.log(session.owner.mnemonic);
};

export const showOwnerContext = async (
  session: OwnerSession,
): Promise<void> => {
  console.log("Active context:");
  console.log(`  DB path: ${session.config.dbPath}`);
  console.log(`  Watch dir: ${session.config.watchDir}`);
  console.log(`  Relay URL: ${session.config.relayUrl}`);
  console.log(`  Owner ID: ${session.owner.id}`);
};

export const restoreOwnerFromMnemonic = async (
  session: OwnerSession,
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

  logger.info("Owner restored.");
  logger.info("Restart required to activate restored owner.");
};

export const resetOwner = async (session: OwnerSession): Promise<void> => {
  await session.evolu.resetAppOwner({ reload: false });

  const flushResult = await session.flush();
  if (!flushResult.ok) {
    throw new Error("Failed to flush reset owner", {
      cause: flushResult.error,
    });
  }

  logger.info("Owner reset.");
  logger.info("Restart required to activate new owner.");
};
