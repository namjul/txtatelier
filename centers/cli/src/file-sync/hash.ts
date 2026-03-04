// Content hashing utilities for file change detection
// Uses Bun's fast native hashing (xxHash64)

export const computeFileHash = async (filePath: string): Promise<string> => {
  const file = Bun.file(filePath);
  const content = await file.arrayBuffer();

  // Bun.hash() uses xxHash64, returns bigint
  // Convert to hex string for storage in Evolu
  const hash = Bun.hash(new Uint8Array(content));
  return hash.toString(16);
};

export const computeContentHash = (content: string): string => {
  // Hash string content directly
  const hash = Bun.hash(content);
  return hash.toString(16);
};
