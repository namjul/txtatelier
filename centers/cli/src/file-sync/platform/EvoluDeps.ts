// Evolu platform dependencies for CLI environment.
// Uses createDbWorkerForPlatform to wire up our custom SQLite driver.

import {
  type CreateWebSocket,
  createConsole,
  createRandom,
  createRandomBytes,
  createTime,
  createWebSocket,
  type EvoluDeps,
} from "@evolu/common";
import { createDbWorkerForPlatform } from "@evolu/common/local-first";
import { logger } from "../../logger";
import { createSqlJsDriver } from "./SqlJsDriver";
import type { PlatformIO } from "./PlatformIO";

export const createEvoluDeps = (io: PlatformIO): EvoluDeps => {
  const sqliteDriverFactory = createSqlJsDriver(io);

  const createLoggedWebSocket: CreateWebSocket = (url, options) => {
    const ws = createWebSocket(url, {
      ...options,
      onOpen: () => {
        logger.debug("[net:websocket:open]", url);
        options?.onOpen?.();
      },
      onError: (error) => {
        logger.error("[net:websocket:error]", error);
        options?.onError?.(error);
      },
      onClose: (event) => {
        logger.warn("[net:websocket:close]", event.code, event.reason);
        options?.onClose?.(event);
      },
      onMessage: (data) => {
        const size =
          typeof data === "string"
            ? data.length
            : data instanceof ArrayBuffer
              ? data.byteLength
              : data.size;
        logger.debug("[net:websocket:message]", size);
        options?.onMessage?.(data);
      },
    });

    return {
      send: (data) => {
        const size =
          typeof data === "string"
            ? data.length
            : data instanceof ArrayBuffer
              ? data.byteLength
              : data instanceof Blob
                ? data.size
                : data.byteLength;
        const result = ws.send(data);
        logger.debug("[net:websocket:send]", size, result.ok ? "ok" : "err");
        return result;
      },
      getReadyState: ws.getReadyState,
      isOpen: ws.isOpen,
      [Symbol.dispose]: () => {
        ws[Symbol.dispose]();
      },
    };
  };

  const createDbWorker = () =>
    createDbWorkerForPlatform({
      // Keep Evolu internals on a fresh console instance. Reusing the shared
      // app logger here caused startup to stall during client initialization.
      console: createConsole(),
      createSqliteDriver: sqliteDriverFactory,
      createWebSocket: createLoggedWebSocket,
      random: createRandom(),
      randomBytes: createRandomBytes(),
      time: createTime(),
    });

  return {
    // Same reason as above: avoid wiring the shared logger into Evolu's core
    // deps path to prevent initialization hangs.
    console: createConsole(),
    createDbWorker,
    randomBytes: createRandomBytes(),
    reloadApp: () => {
      // CLI doesn't need app reload - no-op
    },
    time: createTime(),
  };
};
