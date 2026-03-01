// Phase 0: Loop A (Filesystem → Evolu)
// Watch filesystem changes, compute hashes, update Evolu when content differs

import { homedir } from "node:os";
import { join } from "node:path";
import type { AppOwner, Evolu } from "@evolu/common";
import { createEvoluClient } from "./evolu";
import type { Schema } from "./schema";
import { syncFileToEvolu } from "./sync";
import { startWatching } from "./watch";

const DB_PATH = join(homedir(), ".txtatelier", "txtatelier.db");
const WATCH_DIR = join(homedir(), ".txtatelier", "watched");

type EvoluDatabase = Evolu<typeof Schema>;

let evolu: EvoluDatabase;
let owner: AppOwner;
let closeDb: () => Promise<void>;
let stopWatching: (() => void) | null = null;

export const startFileSync = async (): Promise<void> => {
  console.log("[file-sync] Initializing...");

  // Create Evolu client (handles owner persistence internally)
  const client = await createEvoluClient();
  evolu = client.evolu;
  owner = client.owner;
  closeDb = client.flush;

  // Detect first run (check if DB file exists)
  const isFirstRun = !(await Bun.file(DB_PATH).exists());

  if (isFirstRun) {
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

  // Start Loop A: Watch filesystem and sync to Evolu
  console.log(`[file-sync] Watching directory: ${WATCH_DIR}`);
  stopWatching = await startWatching(WATCH_DIR, async (filePath) => {
    await syncFileToEvolu(evolu, WATCH_DIR, filePath);
  });

  console.log("[file-sync] Ready");
};

export const stopFileSync = async (): Promise<void> => {
  console.log("[file-sync] Shutting down...");

  // Stop watching filesystem
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
    const client = await createEvoluClient();
    owner = client.owner;
  }

  console.log("Your mnemonic:");
  console.log(`  ${owner.mnemonic}`);
  console.log("");
  console.log("⚠️  Keep this secret and secure!");
};

export { evolu };
export type { Schema } from "./schema";
