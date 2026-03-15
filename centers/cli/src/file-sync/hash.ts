// Content hashing utilities for file change detection
// Uses Bun's fast native hashing (xxHash64)

/**
 * Compute hash from bytes (pure function).
 *
 * @param bytes - Raw bytes to hash
 * @returns Hash as hex string
 */
export const computeHash = (bytes: Uint8Array): string => {
  const hash = Bun.hash(bytes);
  return hash.toString(16);
};

/**
 * Compute hash from string content (pure function).
 *
 * @param content - String content to hash
 * @returns Hash as hex string
 */
export const computeContentHash = (content: string): string => {
  const hash = Bun.hash(content);
  return hash.toString(16);
};

/**
 * Read file and compute hash (side effect).
 *
 * @param filePath - Path to file
 * @returns Hash as hex string
 */
export const computeFileHash = async (filePath: string): Promise<string> => {
  const file = Bun.file(filePath);
  const content = await file.arrayBuffer();
  return computeHash(new Uint8Array(content));
};
