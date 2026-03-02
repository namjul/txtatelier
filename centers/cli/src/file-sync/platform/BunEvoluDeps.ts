// Evolu platform dependencies for Bun CLI environment.
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
import { createPersistentBunSqliteDriver } from "./BunSqliteDriver";
import type { PlatformIO } from "./PlatformIO";

export const createBunEvoluDeps = (io: PlatformIO): EvoluDeps => {
  const sqliteDriverFactory = createPersistentBunSqliteDriver(io);

  const createLoggedWebSocket: CreateWebSocket = (url, options) => {
    const ws = createWebSocket(url, {
      ...options,
      onOpen: () => {
        console.log("[evolu-sync] websocket open", url);
        options?.onOpen?.();
      },
      onError: (error) => {
        console.error("[evolu-sync] websocket error", error);
        options?.onError?.(error);
      },
      onClose: (event) => {
        console.warn("[evolu-sync] websocket close", event.code, event.reason);
        options?.onClose?.(event);
      },
      onMessage: (data) => {
        const size =
          typeof data === "string"
            ? data.length
            : data instanceof ArrayBuffer
              ? data.byteLength
              : data.size;
        console.log("[evolu-sync] websocket message", size);
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
        console.log(
          "[evolu-sync] websocket send",
          size,
          result.ok ? "ok" : "err",
        );
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
      console: createConsole(),
      createSqliteDriver: sqliteDriverFactory,
      createWebSocket: createLoggedWebSocket,
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
