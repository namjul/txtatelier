// Bidirectional filesystem sync with Evolu
// Phase 0: Loop A (Filesystem → Evolu)
// Phase 1: Loop B (Evolu → Filesystem)

import { homedir } from "node:os";
import { join } from "node:path";
import type { AppOwner, Evolu } from "@evolu/common";
import { Mnemonic, tryAsync } from "@evolu/common";
import { createEvoluClient } from "./evolu";
import type { Schema } from "./schema";
import { startSyncEvoluToFiles, syncFileToEvolu } from "./sync";
import { startWatching } from "./watch";

const DB_PATH =
  process.env["TXTATELIER_DB_PATH"] ??
  join(homedir(), ".txtatelier", "txtatelier.db");
const WATCH_DIR =
  process.env["TXTATELIER_WATCH_DIR"] ??
  join(homedir(), ".txtatelier", "watched");

type EvoluDatabase = Evolu<typeof Schema>;

let evolu: EvoluDatabase;
let owner: AppOwner;
let closeDb: () => Promise<void>;
let stopWatching: (() => void) | null = null;
let stopSyncing: (() => void) | null = null;

export const startFileSync = async (): Promise<void> => {
  console.log("[file-sync] Initializing...");

  // Create Evolu client (handles owner persistence internally)
  const client = await createEvoluClient({ dbPath: DB_PATH });
  evolu = client.evolu;
  owner = client.owner;
  closeDb = client.flush;

  // Check for mnemonic restoration (test-only feature via environment variable)
  const restoreMnemonicStr = process.env["TXTATELIER_MNEMONIC"];
  if (restoreMnemonicStr && restoreMnemonicStr.trim() !== "") {
    console.log("[file-sync] Restoring from provided mnemonic...");

    // Parse and validate mnemonic
    const mnemonicResult = Mnemonic.from(restoreMnemonicStr);
    if (!mnemonicResult.ok) {
      console.warn(
        "[file-sync] Invalid mnemonic format, using generated owner:",
        mnemonicResult.error,
      );
    } else {
      // Restore mnemonic and persist it to disk.
      const restoreResult = await tryAsync(
        () => evolu.restoreAppOwner(mnemonicResult.value, { reload: false }),
        (error) => error as Error,
      );

      if (restoreResult.ok) {
        console.log("[file-sync] Mnemonic restored to database");
        // Let pending microtasks drain before flushing/recreating client.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        console.log("[file-sync] Flushing database...");

        // Flush the restored database state to disk
        await closeDb();
        console.log("[file-sync] Mnemonic restore persisted");
        console.log("[file-sync] Restart required to activate restored owner");
        process.exit(0);
      } else {
        console.warn(
          "[file-sync] Failed to restore mnemonic, using generated owner:",
          restoreResult.error,
        );
        // Continue with generated owner (test will fail but CLI won't crash)
      }
    }
  }

  const restoreMnemonic = restoreMnemonicStr;

  // Detect first run (check if DB file exists)
  const isFirstRun = !(await Bun.file(DB_PATH).exists());

  if (isFirstRun && !restoreMnemonic) {
    console.log("[file-sync]");
    console.log("[file-sync] First run detected!");
    console.log("[file-sync]");
    console.log("[file-sync] Your mnemonic (save this securely!):");
    console.log(`[file-sync]   ${owner.mnemonic}`);
    console.log("[file-sync]");
    console.log("[file-sync] ⚠️  IMPORTANT: Save this mnemonic!");
    console.log(
      "[file-sync] ⚠️  You'll need it to access your data on other devices.",
    );
    console.log(
      "[file-sync] ⚠️  Run 'txtatelier show-mnemonic' to see it again.",
    );
    console.log("[file-sync]");
  }

  console.log(`[file-sync] Owner ID: ${owner.id}`);

  evolu.subscribeError(() => {
    const error = evolu.getError();
    if (error) {
      console.error("[file-sync] Evolu error:", error);
    }
  });

  // Start Loop A: Watch filesystem and sync to Evolu
  console.log(`[file-sync] Watching directory: ${WATCH_DIR}`);
  stopWatching = await startWatching(WATCH_DIR, async (filePath) => {
    await syncFileToEvolu(evolu, WATCH_DIR, filePath);
  });

  // Start Loop B: Subscribe to Evolu and sync to filesystem
  stopSyncing = startSyncEvoluToFiles(evolu, WATCH_DIR);

  console.log("[file-sync] Ready");
};

export const stopFileSync = async (): Promise<void> => {
  console.log("[file-sync] Shutting down...");

  // Stop Loop B first (stop listening to Evolu)
  if (stopSyncing) {
    stopSyncing();
    stopSyncing = null;
  }

  // Stop Loop A (stop watching filesystem)
  if (stopWatching) {
    stopWatching();
    stopWatching = null;
  }

  // Flush database
  if (closeDb) {
    await closeDb();
  }

  console.log("[file-sync] Stopped");
};

export const showMnemonic = async (): Promise<void> => {
  if (!owner) {
    const client = await createEvoluClient({ dbPath: DB_PATH });
    owner = client.owner;
  }

  console.log("Your mnemonic:");
  console.log(`  ${owner.mnemonic}`);
  console.log("");
  console.log("⚠️  Keep this secret and secure!");
};

export { evolu };
export type { Schema } from "./schema";
