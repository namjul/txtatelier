// Atomic file write utilities
// Uses temp-file + rename pattern to prevent partial writes

import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Ensure a directory exists, creating it and any parent directories if needed.
 */
export const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
  await mkdir(dirPath, { recursive: true });
};

/**
 * Write content to a file atomically.
 * Uses temp-file + rename pattern to prevent:
 * - Partial writes visible to watchers
 * - File corruption from interrupted writes
 * - Filesystem watch storms
 */
export const writeFileAtomic = async (
  filePath: string,
  content: string,
): Promise<void> => {
  // Ensure parent directory exists
  await ensureDirectoryExists(dirname(filePath));

  // Write to temp file first
  const tempPath = `${filePath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  await writeFile(tempPath, content);

  // Atomic rename (this is the key operation)
  // On Unix systems, rename() is atomic at the filesystem level
  await rename(tempPath, filePath);
};
