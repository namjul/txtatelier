// Evolu client creation and management with module-level caching

import { homedir } from "node:os";
import { join } from "node:path";
import {
  type AppOwner,
  createEvolu,
  type Evolu,
  SimpleName,
} from "@evolu/common";
import { Schema } from "./schema";

type EvoluDatabase = Evolu<typeof Schema>;

import { createBunEvoluDeps } from "./platform/BunEvoluDeps";
import { createBunPlatformIO } from "./platform/PlatformIO";

const DB_DIR = join(homedir(), ".txtatelier");
const DB_PATH = join(DB_DIR, "txtatelier.db");

// Module-level cache to prevent WebSocket leaks on reload
// (Evolu doesn't properly dispose WebSocket connections in 7.4.1)
let _cached: {
  evolu: EvoluDatabase;
  flush: () => Promise<void>;
  owner: AppOwner;
} | null = null;

export const createEvoluClient = async ({
  forceNew = false,
}: {
  forceNew?: boolean;
} = {}) => {
  if (_cached && !forceNew) {
    return _cached;
  }

  // Ensure directory exists
  const fs = await import("node:fs/promises");
  await fs.mkdir(DB_DIR, { recursive: true });

  const io = createBunPlatformIO(DB_PATH);
  const deps = createBunEvoluDeps(io);

  const evolu = createEvolu(deps)(Schema, {
    name: SimpleName.orThrow("txtatelier"),
    transports: [], // No sync for Phase 0
  });

  // Get owner (Evolu handles persistence internally)
  const owner = await evolu.appOwner;

  // Flush function - for now, just export and write the database
  const flush = async (): Promise<void> => {
    try {
      const data = await evolu.exportDatabase();
      await io.writeFile(data);
    } catch (e) {
      console.error("[txtatelier] Failed to flush database:", e);
    }
  };

  _cached = { evolu, flush, owner };

  return _cached;
};

export const resetEvolu = async () => {
  if (_cached) {
    await _cached.flush();
  }
  _cached = null;
  // This will generate a new owner on next createEvoluClient call
  return createEvoluClient({ forceNew: true });
};
