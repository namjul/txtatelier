// Content hashing utilities for file change detection

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/**
 * Compute hash from bytes (pure function).
 *
 * Uses **SHA-256** hex, matching the PWA `computeContentHash` (Web Crypto SHA-256).
 * Loop A compares this to `file.contentHash`; if algorithms diverge,
 * Evolu→disk→watch→Evolu will spin forever.
 *
 * @param bytes - Raw bytes to hash
 * @returns Hash as hex string (64 chars)
 */
export const computeHash = (bytes: Uint8Array): string => {
  return createHash("sha256").update(bytes).digest("hex");
};

/**
 * Compute hash from string content (pure function).
 *
 * UTF-8 bytes are hashed (Node default for `update(string)`).
 *
 * @param content - String content to hash
 * @returns Hash as hex string (64 chars)
 */
export const computeContentHash = (content: string): string => {
  return createHash("sha256").update(content).digest("hex");
};

/**
 * Read file and compute hash (side effect).
 *
 * @param filePath - Path to file
 * @returns Hash as hex string
 */
export const computeFileHash = async (filePath: string): Promise<string> => {
  const bytes = await readFile(filePath);
  return computeHash(new Uint8Array(bytes));
};
