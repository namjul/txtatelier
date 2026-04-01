// Content hashing: canonical algorithm in @txtatelier/sync-invariants; disk I/O here.

import { computeContentHash, computeHash } from "@txtatelier/sync-invariants";
import { readFile } from "node:fs/promises";

export { computeContentHash, computeHash };

/**
 * Read file and compute SHA-256 hex hash (same contract as `computeHash` on file bytes).
 */
export const computeFileHash = async (filePath: string): Promise<string> => {
  const bytes = await readFile(filePath);
  return computeHash(new Uint8Array(bytes));
};
