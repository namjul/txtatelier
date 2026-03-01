// Platform-independent file I/O abstraction for SQLite database persistence.
// Follows the pattern from the Obsidian reference implementation.

export type PlatformIO = {
  readonly readFile: () => Promise<Uint8Array | null>;
  readonly writeFile: (data: Uint8Array) => Promise<void>;
};

export const createBunPlatformIO = (dbPath: string): PlatformIO => {
  return {
    readFile: async (): Promise<Uint8Array | null> => {
      try {
        const file = Bun.file(dbPath);
        const exists = await file.exists();
        if (!exists) return null;
        return new Uint8Array(await file.arrayBuffer());
      } catch {
        return null;
      }
    },

    writeFile: async (data: Uint8Array): Promise<void> => {
      // Atomic write: write to temp file, then rename
      // This prevents corruption if process is killed mid-write
      const tempPath = `${dbPath}.tmp`;
      await Bun.write(tempPath, data);

      // Atomic rename (POSIX guarantees atomicity)
      const fs = await import("node:fs/promises");
      await fs.rename(tempPath, dbPath);
    },
  };
};
