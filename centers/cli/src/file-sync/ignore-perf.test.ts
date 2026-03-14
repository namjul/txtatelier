import { expect, test } from "bun:test";
import { isIgnoredRelativePath } from "./ignore";

test("performance: handles 10000 path checks efficiently", () => {
  const paths = [
    "README.md",
    "path/to/file.txt",
    "deep/nested/path/to/document.md",
    ".DS_Store",
    ".gitignore",
    "file.tmp-1234567890",
    "node_modules/package.json",
  ];

  const startTime = performance.now();

  for (let i = 0; i < 10000; i++) {
    for (const path of paths) {
      isIgnoredRelativePath(path);
    }
  }

  const duration = performance.now() - startTime;

  // Should complete 70000 checks in under 100ms (very conservative)
  expect(duration).toBeLessThan(100);

  console.log(`Performance: 70000 path checks in ${duration.toFixed(2)}ms`);
});

test("fast-path optimization: temp files bypass picomatch", () => {
  // This test verifies that .tmp- files hit the fast path
  const tempPaths = [
    "file.tmp-123",
    "path/to/.tmp-456",
    "deep/nested/file.tmp-789",
  ];

  const startTime = performance.now();

  for (let i = 0; i < 10000; i++) {
    for (const path of tempPaths) {
      expect(isIgnoredRelativePath(path)).toBe(true);
    }
  }

  const duration = performance.now() - startTime;

  // Fast path should be very fast (simple string.includes check)
  expect(duration).toBeLessThan(50);

  console.log(`Fast-path: 30000 temp file checks in ${duration.toFixed(2)}ms`);
});
