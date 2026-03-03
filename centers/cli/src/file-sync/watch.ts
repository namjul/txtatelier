// Filesystem watching with debounce using Bun's native watch API

import { watch } from "node:fs/promises";
import { join } from "node:path";

const DEBOUNCE_MS = 100;
const MAX_CONCURRENT = 10; // Limit concurrent file operations

type FileChangeCallback = (absolutePath: string) => void | Promise<void>;

export const startWatching = async (
  watchDir: string,
  onChange: FileChangeCallback,
): Promise<() => void> => {
  console.log(`[watch] Starting to watch: ${watchDir}`);

  // Ensure directory exists
  const fs = await import("node:fs/promises");
  await fs.mkdir(watchDir, { recursive: true });

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
      try {
        await onChange(path);
      } catch (error) {
        console.error(`[watch] Error processing ${path}:`, error);
      } finally {
        activeCount--;
        // Process next item
        void processQueue();
      }
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

  // Start watching using Node.js fs.watch (more stable than Bun.watch for now)
  const watcher = watch(watchDir, { recursive: true });

  // Start async iteration (runs in background)
  void (async () => {
    try {
      for await (const event of watcher) {
        if (!event.filename) continue;

        // Ignore temp files created during atomic writes
        if (event.filename.includes(".tmp-")) {
          continue;
        }

        const absolutePath = join(watchDir, event.filename);
        console.log(`[watch] ${event.eventType}: ${event.filename}`);

        debouncedOnChange(absolutePath);
      }
    } catch (_error) {
      // Watcher was closed
      console.log("[watch] Stopped watching");
    }
  })();

  // Return cleanup function
  return () => {
    console.log("[watch] Stopping watcher...");

    // Clear all debounce timers
    for (const timer of debounceTimers.values()) {
      clearTimeout(timer);
    }
    debounceTimers.clear();

    // Close watcher (will cause watchTask to exit)
    // Note: fs.watch AsyncIterator doesn't have explicit close,
    // but we can just let it end naturally
  };
};
