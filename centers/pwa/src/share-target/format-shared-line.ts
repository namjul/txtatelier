const pad2 = (n: number): string => n.toString().padStart(2, "0");

/**
 * Collapses whitespace (including newlines) to a single space for one log line.
 */
export const normalizeSharedContent = (content: string): string =>
  content.replace(/\s+/g, " ").trim();

/**
 * Single inbox line for a shared capture: `YYYY-MM-DD HH:MM: {content}`.
 */
export const formatSharedLine = (content: string, at: Date): string => {
  const normalized = normalizeSharedContent(content);
  const y = at.getFullYear();
  const m = pad2(at.getMonth() + 1);
  const d = pad2(at.getDate());
  const h = pad2(at.getHours());
  const min = pad2(at.getMinutes());
  return `${y}-${m}-${d} ${h}:${min}: ${normalized}`;
};
