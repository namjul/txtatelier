import { describe, expect, test } from "vitest";
import type { FilesRow } from "../../evolu/files";
import { filterFilesBySubstring } from "./filterFiles";

const mockFiles = (paths: ReadonlyArray<string>): ReadonlyArray<FilesRow> =>
  paths.map((path, i) => {
    const row = {
      path,
      id: String(i) as FilesRow["id"],
      content: null,
      contentHash: "h",
      updatedAt: 0n,
      ownerId: "o" as FilesRow["ownerId"],
    };
    return row as unknown as FilesRow;
  });

describe("filterFilesBySubstring", () => {
  test("returns all files when search is empty or whitespace", () => {
    const files = mockFiles(["a.md", "b/c.md"]);
    expect(filterFilesBySubstring(files, "")).toEqual(files);
    expect(filterFilesBySubstring(files, "  ")).toEqual(files);
  });

  test("matches path substring case-insensitively", () => {
    const files = mockFiles(["Notes/alpha.md", "Beta.md"]);
    expect(
      filterFilesBySubstring(files, "alpha").map((f) => String(f.path)),
    ).toEqual(["Notes/alpha.md"]);
    expect(
      filterFilesBySubstring(files, "BETA").map((f) => String(f.path)),
    ).toEqual(["Beta.md"]);
  });

  test("filtering many files completes quickly", () => {
    const paths = Array.from({ length: 5000 }, (_, i) => `dir/f-${i}.md`);
    const files = mockFiles(paths);
    const t0 = performance.now();
    const out = filterFilesBySubstring(files, "f-42.md");
    const ms = performance.now() - t0;
    expect(out.length).toBe(1);
    expect(String(out[0]?.path)).toBe("dir/f-42.md");
    expect(ms).toBeLessThan(50);
  });
});
