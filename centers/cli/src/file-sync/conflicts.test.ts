import { describe, expect, test } from "bun:test";
import {
  detectConflict,
  generateConflictPath,
  planConflictAction,
} from "./conflicts";

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
      // BASE: A, LOCAL: B (changed), REMOTE: A (unchanged)
      expect(detectConflict("B", "A", "A")).toBe(false);
    });

    test("returns false when only remote changed (local unchanged from base)", () => {
      // BASE: A, LOCAL: A (unchanged), REMOTE: B (changed)
      expect(detectConflict("A", "A", "B")).toBe(false);
    });

    test("returns false when both changed to same value (convergence)", () => {
      // BASE: A, LOCAL: B (changed), REMOTE: B (changed to same value)
      expect(detectConflict("B", "A", "B")).toBe(false);
    });

    test("returns false when nothing changed", () => {
      // BASE: A, LOCAL: A (unchanged), REMOTE: A (unchanged)
      expect(detectConflict("A", "A", "A")).toBe(false);
    });

    test("returns false when remote matches disk (optimization)", () => {
      // Even if both differ from base, if they match each other, no conflict
      // BASE: A, LOCAL: C, REMOTE: C (converged)
      expect(detectConflict("C", "A", "C")).toBe(false);
    });
  });

  describe("Conflict cases - true 3-way merge conflicts", () => {
    test("detects conflict when both changed from base to different values", () => {
      // BASE: A, LOCAL: B (changed), REMOTE: C (changed differently)
      expect(detectConflict("B", "A", "C")).toBe(true);
    });

    test("detects conflict with different base, local, and remote", () => {
      // BASE: X, LOCAL: Y (changed), REMOTE: Z (changed differently)
      expect(detectConflict("Y", "X", "Z")).toBe(true);
    });

    test("detects conflict with hash-like strings", () => {
      // Simulating real hashes
      const base = "abc123";
      const local = "def456";
      const remote = "ghi789";
      expect(detectConflict(local, base, remote)).toBe(true);
    });
  });

  describe("Real-world scenarios", () => {
    test("scenario: file created on device A, not yet on device B", () => {
      // Device B receives file for first time
      // BASE: null (never applied), LOCAL: null (doesn't exist), REMOTE: "hash1"
      expect(detectConflict(null, null, "hash1")).toBe(false);
    });

    test("scenario: file synced, user edits locally, remote unchanged", () => {
      // BASE: "hash1", LOCAL: "hash2" (user edit), REMOTE: "hash1" (unchanged)
      expect(detectConflict("hash2", "hash1", "hash1")).toBe(false);
    });

    test("scenario: file synced, remote edits, local unchanged", () => {
      // BASE: "hash1", LOCAL: "hash1" (unchanged), REMOTE: "hash2" (remote edit)
      expect(detectConflict("hash1", "hash1", "hash2")).toBe(false);
    });

    test("scenario: file synced, both sides edit independently - CONFLICT!", () => {
      // BASE: "hash1", LOCAL: "hash2" (user edit), REMOTE: "hash3" (remote edit)
      expect(detectConflict("hash2", "hash1", "hash3")).toBe(true);
    });

    test("scenario: file synced, both sides make same edit - no conflict", () => {
      // BASE: "hash1", LOCAL: "hash2" (user edit), REMOTE: "hash2" (same edit)
      expect(detectConflict("hash2", "hash1", "hash2")).toBe(false);
    });

    test("scenario: multiple sync cycles with edits", () => {
      // BASE: "v1" (last applied)
      // LOCAL: "v2" (user edited after we applied v1)
      // REMOTE: "v3" (remote device made different edit)
      expect(detectConflict("v2", "v1", "v3")).toBe(true);
    });
  });

  describe("Edge cases", () => {
    test("handles empty string hashes", () => {
      expect(detectConflict("", "", "x")).toBe(false);
      expect(detectConflict("x", "", "y")).toBe(true); //broken
    });

    test("handles single character hashes", () => {
      expect(detectConflict("a", "b", "c")).toBe(true);
      expect(detectConflict("a", "a", "a")).toBe(false);
    });

    test("treats null and empty string differently", () => {
      // null = doesn't exist, "" = exists but empty
      expect(detectConflict("", null, "x")).toBe(false); // no base
      expect(detectConflict(null, "", "x")).toBe(false); // no disk file
    });
  });
});

describe("generateConflictPath - pure path generation", () => {
  test("generates conflict path with owner ID and timestamp", () => {
    const path = generateConflictPath(
      "/dir/file.md",
      "owner123456",
      1234567890,
    );
    expect(path).toBe("/dir/file.conflict-owner123-1234567890.md");
  });

  test("shortens owner ID to 8 chars", () => {
    const path = generateConflictPath("test.txt", "verylongownerid", 111);
    expect(path).toBe("test.conflict-verylong-111.txt");
  });

  test("handles files without extension", () => {
    const path = generateConflictPath("/dir/README", "abc", 999);
    expect(path).toBe("/dir/README.conflict-abc-999");
  });
});

describe("planConflictAction - pure action planning", () => {
  test("creates action with generated path and content", () => {
    const action = planConflictAction("file.md", "content", "owner123");
    expect(action.type).toBe("CREATE_CONFLICT_FILE");
    expect(action.content).toBe("content");
    expect(action.path).toContain("file.conflict-owner123");
  });
});
