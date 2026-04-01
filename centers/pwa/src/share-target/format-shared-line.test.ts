import { describe, expect, test } from "vitest";
import { formatSharedLine, normalizeSharedContent } from "./format-shared-line";

describe("normalizeSharedContent", () => {
  test("collapses newlines and spaces", () => {
    expect(normalizeSharedContent("a\n\nb  c")).toBe("a b c");
  });
});

describe("formatSharedLine", () => {
  test("formats local timestamp and normalized body", () => {
    const at = new Date(2026, 2, 15, 8, 30, 0);
    expect(formatSharedLine("hello\nworld", at)).toBe(
      "2026-03-15 08:30: hello world",
    );
  });
});
