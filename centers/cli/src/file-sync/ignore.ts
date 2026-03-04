export const isIgnoredRelativePath = (relativePath: string): boolean => {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  return normalizedPath.includes(".tmp-");
};
