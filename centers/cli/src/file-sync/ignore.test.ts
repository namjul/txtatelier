import { expect, test } from "vitest";
import { isIgnoredRelativePath } from "./ignore";

test("ignores temp files with .tmp- in path", () => {
  expect(isIgnoredRelativePath("file.tmp-1234567890")).toBe(true);
  expect(isIgnoredRelativePath("path/to/.tmp-1234567890")).toBe(true);
  expect(isIgnoredRelativePath("path/to/file.tmp-abc")).toBe(true);
});

test("ignores system files", () => {
  expect(isIgnoredRelativePath(".DS_Store")).toBe(true);
  expect(isIgnoredRelativePath("path/to/.DS_Store")).toBe(true);
  expect(isIgnoredRelativePath("Thumbs.db")).toBe(true);
  expect(isIgnoredRelativePath("path/to/Thumbs.db")).toBe(true);
  expect(isIgnoredRelativePath("desktop.ini")).toBe(true);
  expect(isIgnoredRelativePath("path/to/desktop.ini")).toBe(true);
});

test("ignores all hidden files (aggressive)", () => {
  expect(isIgnoredRelativePath(".gitignore")).toBe(true);
  expect(isIgnoredRelativePath(".env")).toBe(true);
  expect(isIgnoredRelativePath(".hidden-file")).toBe(true);
  expect(isIgnoredRelativePath("path/to/.secret")).toBe(true);
});

test("ignores hidden directories", () => {
  expect(isIgnoredRelativePath(".archive/file.md")).toBe(true);
  expect(isIgnoredRelativePath("path/.hidden/file.txt")).toBe(true);
});

test("does not ignore regular files", () => {
  expect(isIgnoredRelativePath("README.md")).toBe(false);
  expect(isIgnoredRelativePath("path/to/file.txt")).toBe(false);
  expect(isIgnoredRelativePath("notes.md")).toBe(false);
});

test("does not ignore build artifacts (deferred to Phase 2)", () => {
  expect(isIgnoredRelativePath("node_modules/package.json")).toBe(false);
  expect(isIgnoredRelativePath("dist/index.js")).toBe(false);
  expect(isIgnoredRelativePath("build/output.js")).toBe(false);
});

test("handles Windows paths", () => {
  expect(isIgnoredRelativePath("path\\to\\.DS_Store")).toBe(true);
  expect(isIgnoredRelativePath("path\\to\\file.txt")).toBe(false);
});
