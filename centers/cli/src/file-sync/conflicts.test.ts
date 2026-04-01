import { describe, expect, test } from "vitest";
import { generateConflictPath, planConflictAction } from "./conflicts";

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
