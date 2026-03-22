import { describe, expect, test } from "vitest";
import { computeContentHash, computeHash } from "./hash";

describe("computeHash - pure byte hashing", () => {
  test("computes hash from bytes", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const hash = computeHash(bytes);
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  test("same bytes produce same hash", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(computeHash(bytes)).toBe(computeHash(bytes));
  });

  test("different bytes produce different hash", () => {
    const bytes1 = new Uint8Array([1, 2, 3]);
    const bytes2 = new Uint8Array([3, 2, 1]);
    expect(computeHash(bytes1)).not.toBe(computeHash(bytes2));
  });
});

describe("computeContentHash - pure string hashing", () => {
  test("computes hash from string", () => {
    const hash = computeContentHash("test content");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  test("same content produces same hash", () => {
    const content = "hello world";
    expect(computeContentHash(content)).toBe(computeContentHash(content));
  });

  test("different content produces different hash", () => {
    expect(computeContentHash("a")).not.toBe(computeContentHash("b"));
  });

  test("handles empty string", () => {
    const hash = computeContentHash("");
    expect(typeof hash).toBe("string");
  });
});
