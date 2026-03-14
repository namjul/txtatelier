import picomatch from "picomatch";

const DEFAULT_IGNORE_PATTERNS = [
  // Critical: prevent sync loops
  "**/.tmp-*",
  "**/.*tmp-*",

  // System files
  "**/.DS_Store",
  "**/Thumbs.db",
  "**/desktop.ini",

  // All hidden files and directories (aggressive)
  "**/.*",
  "**/.*/**",
] as const;

const ignoreMatchers = picomatch([...DEFAULT_IGNORE_PATTERNS]);

export const isIgnoredRelativePath = (relativePath: string): boolean => {
  const normalizedPath = relativePath.replaceAll("\\", "/");

  // Fast-path: check for temp files first (most common in hot path)
  if (normalizedPath.includes(".tmp-")) {
    return true;
  }

  return ignoreMatchers(normalizedPath);
};
