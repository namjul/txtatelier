#!/usr/bin/env node
import * as readline from "node:readline";
import { Command, Option, runExit } from "clipanion";
import packageJson from "../package.json" with { type: "json" };
import {
  createOwnerSession,
  resetOwner,
  resolveConfiguredWatchDir,
  showOwnerContext,
  showOwnerMnemonic,
  startFileSync,
} from "./file-sync/index.js";
import { createAllFilesQuery } from "./file-sync/evolu-queries.js";
import {
  createInstanceLock,
  formatDuplicateInstanceMessage,
} from "./file-sync/platform/index.js";
import { createInteractiveLogger } from "./interactive-logger.js";
import {
  bindShortcuts,
  computeStdinInteractive,
  type LoggerDep,
  type ReadlineDep,
  type SessionDep,
  type ShortcutOptionsDep,
  type TTYDep,
} from "./shortcuts.js";

/** Returns an exit code when startup must stop; otherwise never resolves. */
const runStart = async (watchDir?: string): Promise<number | undefined> => {
  const startedAt = Date.now();

  const resolvedWatchDir = resolveConfiguredWatchDir(
    watchDir !== undefined ? { watchDir } : {},
  );
  const instanceLock = createInstanceLock(resolvedWatchDir);
  const lockResult = await instanceLock.acquire();
  if (!lockResult.ok) {
    console.error(
      formatDuplicateInstanceMessage(resolvedWatchDir, lockResult.error),
    );
    return 2;
  }

  const isInteractive = computeStdinInteractive();
  const rl = isInteractive
    ? readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "> ",
      })
    : null;

  const ilog = createInteractiveLogger(rl);

  const result = await startFileSync({
    watchDir: resolvedWatchDir,
    clearConsole: () => {
      ilog.clearScreen();
    },
    beforeQuit: async () => {
      await instanceLock.release();
    },
  });

  if (!result.ok) {
    rl?.close();
    await instanceLock.release();
    console.error("[txtatelier] Fatal error during startup:");
    console.error(result.error);
    return 1;
  }

  const session = result.value;
  const durationMs = Date.now() - startedAt;

  ilog.printStartupBanner({
    clear: true,
    version: packageJson.version,
    durationMs,
  });

  const fileRows = await session.evolu.loadQuery(
    createAllFilesQuery(session.evolu),
  );
  const owner = await session.evolu.appOwner;
  const id = owner.id;
  const ownerShort =
    id.length > 12 ? `${id.slice(0, 6)}...${id.slice(-6)}` : id;

  if (isInteractive) {
    ilog.info("");
    ilog.info(`  ➜  Watching: ${resolvedWatchDir}`);
    ilog.info(`  ➜  ${fileRows.length} files`);
    ilog.info(`  ➜  Owner: ${ownerShort}`);
    ilog.info("");
  } else {
    ilog.info(`Watching: ${resolvedWatchDir}`);
  }

  const shortcutDeps: SessionDep &
    LoggerDep &
    TTYDep &
    ShortcutOptionsDep &
    ReadlineDep = {
    session,
    logger: ilog,
    isTTY: isInteractive,
    options: { print: true },
    readline: rl,
  };

  const unbindShortcuts = bindShortcuts(shortcutDeps);
  session.onStop(() => {
    unbindShortcuts();
  });

  const shutdown = async (signal: string) => {
    ilog.info(`[txtatelier] Received ${signal}, shutting down gracefully...`);
    await session.stop();
    await instanceLock.release();
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  await new Promise(() => {});
  return undefined;
};

abstract class BaseCommand extends Command {
  watchDir = Option.String("--watch-dir", {
    description: "Override the default watched directory",
  });
}

class StartCommand extends BaseCommand {
  static override paths = [Command.Default];
  static override usage = Command.Usage({
    description:
      "Local-first file synchronization CLI. Runs file sync until interrupted.",
  });

  async execute(): Promise<number | undefined> {
    return runStart(this.watchDir);
  }
}

class OwnerCommand extends BaseCommand {
  static override paths = [["owner"]];
  static override usage = Command.Usage({
    description:
      "Manage owner identity (non-interactive). Prefer default start + s / p / d shortcuts in a TTY.",
  });

  show = Option.Boolean("--show", {
    description: "Show owner mnemonic",
  });
  where = Option.Boolean("--where", {
    description: "Show path of owner/mnemonic files",
  });
  reset = Option.Boolean("--reset", {
    description: "Reset owner (destructive)",
  });
  yes = Option.Boolean("--yes", {
    description: "Confirm destructive operation (for --reset)",
  });

  async execute(): Promise<number> {
    const session = await createOwnerSession({
      ...(this.watchDir ? { watchDir: this.watchDir } : {}),
      subscribeFilesShard: false,
    });

    if (this.show) {
      await showOwnerMnemonic(session);
      process.exit(0);
    }

    if (this.where) {
      await showOwnerContext(session);
      process.exit(0);
    }

    if (this.reset) {
      if (!this.yes) {
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
  }
}

void runExit(
  {
    binaryName: packageJson.name,
    binaryLabel: "TXTAelier",
    binaryVersion: packageJson.version,
    enableColors: false,
  },
  [StartCommand, OwnerCommand],
);
