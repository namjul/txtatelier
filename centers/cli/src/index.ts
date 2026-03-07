import { bin } from "specialist";
import packageJson from "../package.json" with { type: "json" };
import {
  resetOwner,
  restoreOwnerFromMnemonic,
  showOwnerContext,
  showOwnerMnemonic,
  startFileSync,
  stopFileSync,
} from "./file-sync/index.js";

const runStart = async (): Promise<void> => {
  console.log("[txtatelier] Starting...");

  await startFileSync();

  const shutdown = async (signal: string) => {
    console.log(`[txtatelier] Received ${signal}, shutting down gracefully...`);
    await stopFileSync();
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
  .argument("[--watch-dir]", "Override the default watched directory")
  .action(async () => {
    await runStart();
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
  .action(async (options: any) => {
    if (options.show) {
      await showOwnerMnemonic();
      process.exit(0);
    }

    if (options.where) {
      await showOwnerContext();
      process.exit(0);
    }

    if (options.restore) {
      const mnemonic = Array.isArray(options.restore)
        ? options.restore.join(" ")
        : options.restore;
      await restoreOwnerFromMnemonic(mnemonic as string);
      process.exit(0);
    }

    if (options.reset) {
      if (!options.yes) {
        console.error(
          "Reset is destructive. Re-run with: txtatelier owner --reset --yes",
        );
        process.exit(1);
      }
      await resetOwner();
      process.exit(0);
    }

    console.error("No action specified. Use --help to see available options.");
    process.exit(1);
  })

  .run();
