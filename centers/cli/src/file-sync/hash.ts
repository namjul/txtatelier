// Content hashing utilities for file change detection

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/**
 * Compute hash from bytes (pure function).
 *
 * @param bytes - Raw bytes to hash
 * @returns Hash as hex string
 */
export const computeHash = (bytes: Uint8Array): string => {
  return createHash("sha1").update(bytes).digest("hex");
};

/**
 * Compute hash from string content (pure function).
 *
 * @param content - String content to hash
 * @returns Hash as hex string
 */
export const computeContentHash = (content: string): string => {
  return createHash("sha1").update(content).digest("hex");
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
