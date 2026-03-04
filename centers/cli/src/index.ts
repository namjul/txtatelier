import { startFileSync, stopFileSync } from "./file-sync/index.js";
import { logger } from "./logger";

logger.log("[txtatelier] Starting...");

// Start file-sync
await startFileSync();

// Setup graceful shutdown handlers
const shutdown = async (signal: string) => {
  logger.log(`[txtatelier] Received ${signal}, shutting down gracefully...`);
  await stopFileSync();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Keep process alive
logger.log("[txtatelier] Running (press Ctrl+C to stop)");
await new Promise(() => {});
