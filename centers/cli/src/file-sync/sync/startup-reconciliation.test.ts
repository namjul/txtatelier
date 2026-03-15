import { describe, expect, test } from "bun:test";
import { decideReconcileAction } from "./startup-reconciliation";

describe("decideReconcileAction - pure reconciliation logic", () => {
  const content = "test content";
  const hash = "abc123";

  describe("SKIP cases", () => {
    test("skips when already processed", () => {
      const decision = decideReconcileAction("xyz", hash, hash, content);
      expect(decision).toEqual({ type: "SKIP", reason: "already-processed" });
    });

    test("skips when disk matches evolu", () => {
      const decision = decideReconcileAction(hash, "old", hash, content);
      expect(decision).toEqual({ type: "SKIP", reason: "disk-matches-evolu" });
    });
  });

  describe("WRITE_FROM_EVOLU cases", () => {
    test("writes when file doesn't exist on disk", () => {
      const decision = decideReconcileAction(null, "old", hash, content);
      expect(decision).toEqual({
        type: "WRITE_FROM_EVOLU",
        content,
        hash,
      });
    });

    test("writes when disk unchanged from last applied", () => {
      const decision = decideReconcileAction("old", "old", hash, content);
      expect(decision).toEqual({
        type: "WRITE_FROM_EVOLU",
        content,
        hash,
      });
    });
  });

  describe("CONFLICT cases", () => {
    test("detects conflict when disk differs from both", () => {
      const diskHash = "disk123";
      const lastApplied = "old456";
      const decision = decideReconcileAction(
        diskHash,
        lastApplied,
        hash,
        content,
      );
      expect(decision).toEqual({
        type: "CONFLICT",
        diskHash,
        evolHash: hash,
      });
    });
  });
});
