#!/usr/bin/env node
import { bin } from "specialist";
import packageJson from "../package.json" with { type: "json" };
import {
  createOwnerSession,
  resetOwner,
  resolveConfiguredWatchDir,
  showOwnerContext,
  showOwnerMnemonic,
  startFileSync,
} from "./file-sync/index.js";
import {
  createInstanceLock,
  formatDuplicateInstanceMessage,
} from "./file-sync/platform/index.js";

const runStart = async (watchDir?: string): Promise<void> => {
  console.log("[txtatelier] Starting...");

  const resolvedWatchDir = resolveConfiguredWatchDir(
    watchDir !== undefined ? { watchDir } : {},
  );
  const instanceLock = createInstanceLock(resolvedWatchDir);
  const lockResult = await instanceLock.acquire();
  if (!lockResult.ok) {
    console.error(
      formatDuplicateInstanceMessage(resolvedWatchDir, lockResult.error),
    );
    process.exit(2);
  }

  const result = await startFileSync({ watchDir: resolvedWatchDir });

  if (!result.ok) {
    await instanceLock.release();
    console.error("[txtatelier] Fatal error during startup:");
    console.error(result.error);
    process.exit(1);
  }

  const session = result.value;

  const shutdown = async (signal: string) => {
    console.log(`[txtatelier] Received ${signal}, shutting down gracefully...`);
    await session.stop();
    await instanceLock.release();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  console.log("[txtatelier] Running (press Ctrl+C to stop)");
  await new Promise(() => {});
};

bin("txtatelier", "Local-first file synchronization CLI")
  .config({
    package: packageJson.name,
    version: packageJson.version,
    colors: false,
  })
  .option("--watch-dir <path>", "Override the default watched directory")
  .action(async (options) => {
    await runStart(options.watchDir);
  })

  .command("owner", "Manage owner identity")
  .option("--show", "Show owner mnemonic")
  .option("--where", "Show path of owner/mnemonic files")
  .option("--reset", "Reset owner (destructive)")
  .option("--yes", "Confirm destructive operation (for --reset)")
  .action(async (options) => {
    // Use lightweight session for owner queries (doesn't start file sync)
    const session = await createOwnerSession({
      ...(options.watchDir && { watchDir: options.watchDir }),
    });

    if (options.show) {
      await showOwnerMnemonic(session);
      process.exit(0);
    }

    if (options.where) {
      await showOwnerContext(session);
      process.exit(0);
    }

    if (options.reset) {
      if (!options.yes) {
        console.error(
          "Reset is destructive. Re-run with: txtatelier owner --reset --yes",
        );
        process.exit(1);
      }

      await resetOwner(session);
      process.exit(0);
    }

    console.error("No action specified. Use --help to see available options.");
    process.exit(1);
  })

  .run();
