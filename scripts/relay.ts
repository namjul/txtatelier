#!/usr/bin/env tsx
/**
 * Local Evolu Relay Server
 *
 * Self-hosted WebSocket relay for multi-device sync during development.
 * Stores relay database in ~/.txtatelier-relay directory by default.
 *
 * Usage:
 *   bun relay                    # via npm script
 *   tsx scripts/relay.ts         # directly
 *   ./scripts/relay.ts           # if executable
 *
 * Configuration:
 *   TXTATELIER_RELAY_PORT        Port to run on (default: 4000)
 *   TXTATELIER_RELAY_QUOTA_MB    Quota per owner in MB (default: 10)
 *   TXTATELIER_RELAY_LOGGING     Enable verbose logging (set to "true")
 *   TXTATELIER_RELAY_DATA        Custom data directory (default: ~/.txtatelier-relay)
 *
 * Example:
 *   TXTATELIER_RELAY_PORT=8080 TXTATELIER_RELAY_QUOTA_MB=100 bun relay
 */

import { createConsole } from "@evolu/common";
import { createNodeJsRelay } from "@evolu/nodejs";
import { mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Store relay database in ~/.txtatelier-relay (or custom location via env var)
const relayDataDir =
  process.env["TXTATELIER_RELAY_DATA"] || join(homedir(), ".txtatelier-relay");
mkdirSync(relayDataDir, { recursive: true });

const port = Number(process.env["TXTATELIER_RELAY_PORT"]) || 4000;
const quotaMB = Number(process.env["TXTATELIER_RELAY_QUOTA_MB"]) || 10;
const maxBytes = quotaMB * 1024 * 1024;
const enableLogging = process.env["TXTATELIER_RELAY_LOGGING"] === "true";

console.log("Starting Evolu relay server...");
console.log(`  Port: ${port}`);
console.log(`  Data directory: ${relayDataDir}`);
console.log(`  Quota per owner: ${quotaMB}MB`);
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
