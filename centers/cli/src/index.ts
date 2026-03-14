#!/usr/bin/env bun
import { bin } from "specialist";
import packageJson from "../package.json" with { type: "json" };
import {
  createOwnerSession,
  resetOwner,
  restoreOwnerFromMnemonic,
  showOwnerContext,
  showOwnerMnemonic,
  startFileSync,
} from "./file-sync/index.js";

const runStart = async (watchDir?: string): Promise<void> => {
  console.log("[txtatelier] Starting...");

  const session = await startFileSync({ ...(watchDir && { watchDir }) });

  const shutdown = async (signal: string) => {
    console.log(`[txtatelier] Received ${signal}, shutting down gracefully...`);
    await session.stop();
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
    autoExit: false,
  })
  .option("--watch-dir <path>", "Override the default watched directory")
  .action(async (options) => {
    await runStart(options.watchDir);
    process.exit(0);
  })

  .command("owner", "Manage owner identity")
  .option("--show", "Show owner mnemonic")
  .option("--where", "Show path of owner/mnemonic files")
  .option({
    name: "--restore <words...>",
    description: "Restore owner from mnemonic",
    eager: true,
  })
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

    if (options.restore) {
      const mnemonic = Array.isArray(options.restore)
        ? options.restore.join(" ")
        : options.restore;
      await restoreOwnerFromMnemonic(session, mnemonic as string);
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
