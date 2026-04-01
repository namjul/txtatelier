import { describe, expect, test } from "vitest";
import { detectConflict } from "./detectConflict.ts";

describe("detectConflict - 3-way merge semantics", () => {
  describe("No conflict cases", () => {
    test("returns false when file doesn't exist on disk (diskHash is null)", () => {
      expect(detectConflict(null, "A", "B")).toBe(false);
    });

    test("returns false when no base exists (lastAppliedHash is null, new file)", () => {
      expect(detectConflict("B", null, "C")).toBe(false);
    });

    test("returns false when both are null", () => {
      expect(detectConflict(null, null, "A")).toBe(false);
    });

    test("returns false when only local changed (remote unchanged from base)", () => {
      expect(detectConflict("B", "A", "A")).toBe(false);
    });

    test("returns false when only remote changed (local unchanged from base)", () => {
      expect(detectConflict("A", "A", "B")).toBe(false);
    });

    test("returns false when both changed to same value (convergence)", () => {
      expect(detectConflict("B", "A", "B")).toBe(false);
    });

    test("returns false when nothing changed", () => {
      expect(detectConflict("A", "A", "A")).toBe(false);
    });

    test("returns false when remote matches disk (optimization)", () => {
      expect(detectConflict("C", "A", "C")).toBe(false);
    });
  });

  describe("Conflict cases - true 3-way merge conflicts", () => {
    test("detects conflict when both changed from base to different values", () => {
      expect(detectConflict("B", "A", "C")).toBe(true);
    });

    test("detects conflict with different base, local, and remote", () => {
      expect(detectConflict("Y", "X", "Z")).toBe(true);
    });

    test("detects conflict with hash-like strings", () => {
      expect(detectConflict("def456", "abc123", "ghi789")).toBe(true);
    });
  });

  describe("Real-world scenarios", () => {
    test("scenario: file created on device A, not yet on device B", () => {
      expect(detectConflict(null, null, "hash1")).toBe(false);
    });

    test("scenario: file synced, user edits locally, remote unchanged", () => {
      expect(detectConflict("hash2", "hash1", "hash1")).toBe(false);
    });

    test("scenario: file synced, remote edits, local unchanged", () => {
      expect(detectConflict("hash1", "hash1", "hash2")).toBe(false);
    });

    test("scenario: file synced, both sides edit independently - CONFLICT!", () => {
      expect(detectConflict("hash2", "hash1", "hash3")).toBe(true);
    });

    test("scenario: file synced, both sides make same edit - no conflict", () => {
      expect(detectConflict("hash2", "hash1", "hash2")).toBe(false);
    });

    test("scenario: multiple sync cycles with edits", () => {
      expect(detectConflict("v2", "v1", "v3")).toBe(true);
    });
  });

  describe("Edge cases", () => {
    test("handles empty string hashes", () => {
      expect(detectConflict("", "", "x")).toBe(false);
      expect(detectConflict("x", "", "y")).toBe(true);
    });

    test("handles single character hashes", () => {
      expect(detectConflict("a", "b", "c")).toBe(true);
      expect(detectConflict("a", "a", "a")).toBe(false);
    });

    test("treats null and empty string differently", () => {
      expect(detectConflict("", null, "x")).toBe(false);
      expect(detectConflict(null, "", "x")).toBe(false);
    });
  });
});
