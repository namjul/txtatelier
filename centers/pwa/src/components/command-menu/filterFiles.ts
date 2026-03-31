import type { FilesRow } from "../../evolu/files";

/**
 * Case-insensitive substring match on file path (command menu search).
 */
export const filterFilesBySubstring = (
  files: ReadonlyArray<FilesRow>,
  searchTerm: string,
): ReadonlyArray<FilesRow> => {
  const t = searchTerm.trim().toLowerCase();
  if (t === "") return files;
  return files.filter((f) => f.path.toLowerCase().includes(t));
};
