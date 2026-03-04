import { parseArgv } from "specialist";
import {
  resetOwner,
  restoreOwnerFromMnemonic,
  showOwnerContext,
  showOwnerMnemonic,
  startFileSync,
  stopFileSync,
} from "./file-sync/index.js";

const parsed = parseArgv(process.argv.slice(2), {
  boolean: ["help", "yes"],
  alias: {
    help: ["h"],
    yes: ["y"],
  },
});

const [command, subcommand, value] = parsed._ as ReadonlyArray<string>;

const printUsage = (): void => {
  console.log("txtatelier CLI");
  console.log("");
  console.log("Usage:");
  console.log("  txtatelier");
  console.log("  txtatelier start");
  console.log("  txtatelier owner show");
  console.log("  txtatelier owner where");
  console.log("  txtatelier owner restore <mnemonic>");
  console.log("  txtatelier owner reset --yes");
};

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

if (parsed["help"]) {
  printUsage();
  process.exit(0);
}

if (command === undefined || command === "start") {
  await runStart();
  process.exit(0);
}

if (command === "owner") {
  if (subcommand === "show") {
    await showOwnerMnemonic();
    process.exit(0);
  }

  if (subcommand === "where") {
    await showOwnerContext();
    process.exit(0);
  }

  if (subcommand === "restore") {
    if (!value) {
      console.error(
        "Missing mnemonic. Usage: txtatelier owner restore <mnemonic>",
      );
      process.exit(1);
    }

    await restoreOwnerFromMnemonic(value);
    process.exit(0);
  }

  if (subcommand === "reset") {
    if (!parsed["yes"]) {
      console.error(
        "Reset is destructive. Re-run with: txtatelier owner reset --yes",
      );
      process.exit(1);
    }

    await resetOwner();
    process.exit(0);
  }

  console.error(`Unknown owner command: ${subcommand ?? "<missing>"}`);
  printUsage();
  process.exit(1);
}

console.error(`Unknown command: ${command}`);
printUsage();
process.exit(1);
