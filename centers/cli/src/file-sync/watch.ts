// Filesystem watching with debounce using chokidar.

import { mkdir } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { tryAsync } from "@evolu/common";
import { watch } from "chokidar";
import { logger } from "../logger";
import type { WatchQueueTaskError, WatchShutdownError } from "./errors";

const DEBOUNCE_MS = 100;
const MAX_CONCURRENT = 10; // Limit concurrent file operations

type FileChangeCallback = (absolutePath: string) => void | Promise<void>;

export const startWatching = async (
  watchDir: string,
  onChange: FileChangeCallback,
): Promise<() => void> => {
  logger.log(`[watch] Starting to watch: ${watchDir}`);

  // Ensure directory exists
  await mkdir(watchDir, { recursive: true });

  // Debounce map: path -> timeout
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Concurrency control: queue and active set
  const queue: string[] = [];
  let activeCount = 0;

  const processQueue = async () => {
    while (queue.length > 0 && activeCount < MAX_CONCURRENT) {
      const path = queue.shift();
      if (!path) continue;

      activeCount++;
      const result = await tryAsync(
        () => Promise.resolve(onChange(path)),
        (cause): WatchQueueTaskError => ({
          type: "WatchQueueTaskFailed",
          path,
          cause,
        }),
      );

      if (!result.ok) {
        logger.error(`[watch] Error processing ${path}:`, result.error);
      }

      activeCount--;
      // Process next item
      void processQueue();
    }
  };

  const debouncedOnChange = (path: string) => {
    // Clear existing timer for this path
    const existingTimer = debounceTimers.get(path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      debounceTimers.delete(path);

      // Add to queue instead of calling directly
      queue.push(path);
      void processQueue();
    }, DEBOUNCE_MS);

    debounceTimers.set(path, timer);
  };

  const isWithinWatchDir = (absolutePath: string): boolean => {
    // Safety boundary: chokidar events can surface different path shapes
    // across platforms and edge cases (rename/symlink). Only accept paths
    // that are strict descendants of watchDir.
    const rel = relative(watchDir, absolutePath);
    return rel !== "" && rel !== "." && !rel.startsWith("..");
  };

  const toAbsolutePath = (changedPath: string): string => {
    return isAbsolute(changedPath) ? changedPath : join(watchDir, changedPath);
  };

  const watcher = watch(watchDir, {
    // Do not emit synthetic "add" events for files already present at startup.
    // Initial snapshot handling belongs to explicit startup reconciliation
    // (Phase 5), not to watcher side effects. This avoids a boot-time race where
    // capture (filesystem -> Evolu) and materialization (Evolu -> filesystem)
    // both try to act on the same pre-existing files.
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: DEBOUNCE_MS,
      pollInterval: 25,
    },
    ignored: (changedPath) => changedPath.includes(".tmp-"),
  });

  const handleFileEvent = (eventType: string, changedPath: string): void => {
    const absolutePath = toAbsolutePath(changedPath);

    if (!isWithinWatchDir(absolutePath)) {
      return;
    }

    logger.log(
      `[watch] ${eventType}: ${relative(watchDir, absolutePath).replaceAll("\\", "/")}`,
    );
    debouncedOnChange(absolutePath);
  };

  watcher.on("add", (changedPath) => {
    handleFileEvent("add", changedPath);
  });

  watcher.on("change", (changedPath) => {
    handleFileEvent("change", changedPath);
  });

  watcher.on("unlink", (changedPath) => {
    handleFileEvent("unlink", changedPath);
  });

  watcher.on("error", (error) => {
    logger.error("[watch] Watcher error:", error);
  });

  // Return cleanup function
  return () => {
    logger.log("[watch] Stopping watcher...");

    // Clear all debounce timers
    for (const timer of debounceTimers.values()) {
      clearTimeout(timer);
    }
    debounceTimers.clear();

    void (async () => {
      const closeResult = await tryAsync(
        () => watcher.close(),
        (cause): WatchShutdownError => ({
          type: "WatchCloseFailed",
          cause,
        }),
      );

      if (!closeResult.ok) {
        logger.error("[watch] Failed to close watcher:", closeResult.error);
      }
    })();

    logger.log("[watch] Stopped watching");
  };
};
