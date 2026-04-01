import { describe, expect, test } from "vitest";
import { computeContentHash, computeHash } from "./contentHash.ts";

describe("computeHash", () => {
  test("computes hash from bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const hash = await computeHash(bytes);
    expect(typeof hash).toBe("string");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("same bytes produce same hash", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(await computeHash(bytes)).toBe(await computeHash(bytes));
  });

  test("different bytes produce different hash", async () => {
    const bytes1 = new Uint8Array([1, 2, 3]);
    const bytes2 = new Uint8Array([3, 2, 1]);
    expect(await computeHash(bytes1)).not.toBe(await computeHash(bytes2));
  });
});

describe("computeContentHash", () => {
  test("computes hash from string", async () => {
    const hash = await computeContentHash("test content");
    expect(typeof hash).toBe("string");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("same content produces same hash", async () => {
    const content = "hello world";
    expect(await computeContentHash(content)).toBe(
      await computeContentHash(content),
    );
  });

  test("different content produces different hash", async () => {
    expect(await computeContentHash("a")).not.toBe(
      await computeContentHash("b"),
    );
  });

  test("handles empty string", async () => {
    const hash = await computeContentHash("");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("matches Node createHash utf-8 contract (golden)", async () => {
    const content = "evolu edit";
    const fromWebCrypto = await computeContentHash(content);
    const { createHash } = await import("node:crypto");
    const fromNode = createHash("sha256").update(content).digest("hex");
    expect(fromWebCrypto).toBe(fromNode);
  });
});
