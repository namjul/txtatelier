// Evolu platform dependencies for Bun CLI environment.
// Uses createDbWorkerForPlatform to wire up our custom SQLite driver.

import {
  createConsole,
  createRandom,
  createRandomBytes,
  createTime,
  createWebSocket,
  type EvoluDeps,
} from "@evolu/common";
import { createDbWorkerForPlatform } from "@evolu/common/local-first";
import { createPersistentBunSqliteDriver } from "./BunSqliteDriver";
import type { PlatformIO } from "./PlatformIO";

export const createBunEvoluDeps = (io: PlatformIO): EvoluDeps => {
  const sqliteDriverFactory = createPersistentBunSqliteDriver(io);

  const createDbWorker = () =>
    createDbWorkerForPlatform({
      console: createConsole(),
      createSqliteDriver: sqliteDriverFactory,
      createWebSocket,
      random: createRandom(),
      randomBytes: createRandomBytes(),
      time: createTime(),
    });

  return {
    console: createConsole(),
    createDbWorker,
    randomBytes: createRandomBytes(),
    reloadApp: () => {
      // CLI doesn't need app reload - no-op
    },
    time: createTime(),
  };
};
