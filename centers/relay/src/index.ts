#!/usr/bin/env tsx
import { createConsole } from "@evolu/common";
import { createNodeJsRelay } from "@evolu/nodejs";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Store relay database in ./data/relay/ relative to repo root
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");
const relayDataDir = join(repoRoot, "data", "relay");
mkdirSync(relayDataDir, { recursive: true });

const port = Number(process.env["TXTATELIER_RELAY_PORT"]) || 4000;
const maxBytes = 10 * 1024 * 1024; // 10MB quota
const enableLogging = process.env["TXTATELIER_RELAY_LOGGING"] === "true";

console.log("Starting Evolu relay server...");
console.log(`  Port: ${port}`);
console.log(`  Data directory: ${relayDataDir}`);
console.log(`  Quota per owner: ${maxBytes / (1024 * 1024)}MB`);
console.log(`  Logging: ${enableLogging ? "enabled" : "disabled"}`);
console.log();

// Change to relay data directory for database creation
process.chdir(relayDataDir);

const relay = await createNodeJsRelay({
  console: createConsole(),
})({
  port,
  enableLogging,
  isOwnerWithinQuota: (_ownerId, requiredBytes) => {
    return requiredBytes <= maxBytes;
  },
});

if (relay.ok) {
  console.log(`Relay server running at ws://localhost:${port}/<ownerId>`);
  console.log("Press Ctrl+C to stop");
  console.log();

  process.once("SIGINT", () => {
    console.log("\nShutting down relay server...");
    relay.value[Symbol.dispose]();
  });
  process.once("SIGTERM", () => {
    console.log("\nShutting down relay server...");
    relay.value[Symbol.dispose]();
  });
} else {
  console.error("Failed to start relay server:");
  console.error(relay.error);
  process.exit(1);
}
