#!/usr/bin/env node
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
import {
  createInstanceLock,
  formatDuplicateInstanceMessage,
} from "./file-sync/platform/index.js";

/** Returns an exit code when startup must stop; otherwise never resolves. */
const runStart = async (watchDir?: string): Promise<number | void> => {
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
    return 2;
  }

  const result = await startFileSync({ watchDir: resolvedWatchDir });

  if (!result.ok) {
    await instanceLock.release();
    console.error("[txtatelier] Fatal error during startup:");
    console.error(result.error);
    return 1;
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

  async execute(): Promise<number | void> {
    return runStart(this.watchDir);
  }
}

class OwnerCommand extends BaseCommand {
  static override paths = [["owner"]];
  static override usage = Command.Usage({
    description: "Manage owner identity",
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
    });

    if (this.show) {
      await showOwnerMnemonic(session);
      return 0;
    }

    if (this.where) {
      await showOwnerContext(session);
      return 0;
    }

    if (this.reset) {
      if (!this.yes) {
        console.error(
          "Reset is destructive. Re-run with: txtatelier owner --reset --yes",
        );
        return 1;
      }

      await resetOwner(session);
      return 0;
    }

    console.error("No action specified. Use --help to see available options.");
    return 1;
  }
}

void runExit(
  {
    binaryName: packageJson.name,
    binaryLabel: 'TXTAelier',
    binaryVersion: packageJson.version,
    enableColors: false,
  },
  [StartCommand, OwnerCommand],
)
