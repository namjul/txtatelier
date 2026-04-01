import { describe, expect, test } from "vitest";
import { validateInboxPath } from "./inbox-path-validation";

describe("validateInboxPath", () => {
  test("accepts relative markdown path", () => {
    const r = validateInboxPath("inbox.md");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("inbox.md");
  });

  test("normalizes backslashes", () => {
    const r = validateInboxPath(String.raw`notes\inbox.md`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("notes/inbox.md");
  });

  test("rejects ..", () => {
    const r = validateInboxPath("../secret.md");
    expect(r.ok).toBe(false);
  });

  test("rejects absolute path", () => {
    const r = validateInboxPath("/etc/passwd.md");
    expect(r.ok).toBe(false);
  });

  test("rejects non-md", () => {
    const r = validateInboxPath("note.txt");
    expect(r.ok).toBe(false);
  });
});
