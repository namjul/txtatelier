export const DEFAULT_INBOX_PATH = "inbox.md";

export type InboxPathValidationError =
  | { readonly type: "Empty" }
  | { readonly type: "NotMarkdown" }
  | { readonly type: "PathTraversal" }
  | { readonly type: "AbsolutePath" };

export type InboxPathResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: InboxPathValidationError };

/**
 * Validates inbox path for PWA settings: relative to the synced watch root (no `..`),
 * must end in `.md`. Backslashes are normalized to `/`.
 */
export const validateInboxPath = (raw: string): InboxPathResult => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: { type: "Empty" } };
  }
  if (trimmed.startsWith("/")) {
    return { ok: false, error: { type: "AbsolutePath" } };
  }
  if (trimmed.includes("..")) {
    return { ok: false, error: { type: "PathTraversal" } };
  }
  if (!trimmed.toLowerCase().endsWith(".md")) {
    return { ok: false, error: { type: "NotMarkdown" } };
  }
  const normalized = trimmed.replace(/\\/g, "/");
  return { ok: true, value: normalized };
};

export const formatInboxPathValidationError = (
  error: InboxPathValidationError,
): string => {
  switch (error.type) {
    case "Empty":
      return "Inbox path cannot be empty";
    case "NotMarkdown":
      return "Inbox path must end with .md";
    case "PathTraversal":
      return "Inbox path cannot contain ..";
    case "AbsolutePath":
      return "Inbox path must be relative (no leading /)";
    default:
      return "Invalid inbox path";
  }
};
