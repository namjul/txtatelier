import { describe, expect, test } from "vitest";
import { generateStateId } from "./state";

describe("generateStateId - pure ID generation", () => {
  test("generates deterministic ID from path", () => {
    const id1 = generateStateId("test/file.md");
    const id2 = generateStateId("test/file.md");
    expect(id1).toBe(id2);
  });

  test("different paths produce different IDs", () => {
    const id1 = generateStateId("file1.md");
    const id2 = generateStateId("file2.md");
    expect(id1).not.toBe(id2);
  });

  test("handles special characters in path", () => {
    const id = generateStateId("path/with spaces/file.md");
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });
});
