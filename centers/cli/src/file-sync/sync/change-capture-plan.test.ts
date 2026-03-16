import { describe, expect, test } from "bun:test";
import { planChangeCapture } from "./change-capture-plan";
import type { ChangeCaptureState } from "./state-types";

describe("planChangeCapture - pure planning logic", () => {
  describe("file unchanged", () => {
    test("WHEN disk hash equals evol hash THEN plan includes SKIP action", () => {
      const state: ChangeCaptureState = {
        path: "test.md",
        diskHash: "abc123",
        diskContent: "content",
        evolHash: "abc123",
        evolId: "file-id-1",
      };

      const plan = planChangeCapture(state);

      expect(
        plan.some((a) => a.type === "SKIP" && a.reason === "hash-matches"),
      ).toBe(true);
    });
  });

  describe("file modified", () => {
    test("WHEN file exists with different hash THEN plan includes UPDATE_EVOLU action", () => {
      const state: ChangeCaptureState = {
        path: "test.md",
        diskHash: "new-hash",
        diskContent: "new content",
        evolHash: "old-hash",
        evolId: "file-id-1",
      };

      const plan = planChangeCapture(state);

      const updateAction = plan.find((a) => a.type === "UPDATE_EVOLU");
      expect(updateAction).toBeDefined();
      if (updateAction && updateAction.type === "UPDATE_EVOLU") {
        expect(updateAction.id).toBe("file-id-1");
        expect(updateAction.path).toBe("test.md");
        expect(updateAction.content).toBe("new content");
        expect(updateAction.hash).toBe("new-hash");
      }
    });
  });

  describe("new file", () => {
    test("WHEN file not in evolu THEN plan includes INSERT_EVOLU action", () => {
      const state: ChangeCaptureState = {
        path: "new.md",
        diskHash: "hash123",
        diskContent: "content",
        evolHash: null,
        evolId: null,
      };

      const plan = planChangeCapture(state);

      const insertAction = plan.find((a) => a.type === "INSERT_EVOLU");
      expect(insertAction).toBeDefined();
      if (insertAction && insertAction.type === "INSERT_EVOLU") {
        expect(insertAction.path).toBe("new.md");
        expect(insertAction.content).toBe("content");
        expect(insertAction.hash).toBe("hash123");
      }
    });
  });

  describe("file deleted", () => {
    test("WHEN file deleted and exists in evolu THEN plan includes MARK_DELETED and CLEAR_TRACKED actions", () => {
      const state: ChangeCaptureState = {
        path: "deleted.md",
        diskHash: null,
        diskContent: null,
        evolHash: "old-hash",
        evolId: "file-id-1",
      };

      const plan = planChangeCapture(state);

      expect(plan.some((a) => a.type === "MARK_DELETED_EVOLU")).toBe(true);
      expect(plan.some((a) => a.type === "CLEAR_TRACKED_HASH")).toBe(true);

      const markDeleted = plan.find((a) => a.type === "MARK_DELETED_EVOLU");
      if (markDeleted && markDeleted.type === "MARK_DELETED_EVOLU") {
        expect(markDeleted.id).toBe("file-id-1");
        expect(markDeleted.path).toBe("deleted.md");
      }
    });

    test("WHEN file deleted but not in evolu THEN plan skips", () => {
      const state: ChangeCaptureState = {
        path: "not-tracked.md",
        diskHash: null,
        diskContent: null,
        evolHash: null,
        evolId: null,
      };

      const plan = planChangeCapture(state);

      expect(
        plan.some((a) => a.type === "SKIP" && a.reason === "file-not-found"),
      ).toBe(true);
    });
  });

  describe("ignored path", () => {
    test("WHEN path is ignored THEN plan skips with ignored-path reason", () => {
      const state: ChangeCaptureState = {
        path: ".git/config",
        diskHash: "hash",
        diskContent: "content",
        evolHash: null,
        evolId: null,
      };

      const plan = planChangeCapture(state);

      expect(
        plan.some((a) => a.type === "SKIP" && a.reason === "ignored-path"),
      ).toBe(true);
    });
  });

  describe("logging", () => {
    test("WHEN planning any action THEN plan includes LOG action", () => {
      const state: ChangeCaptureState = {
        path: "test.md",
        diskHash: "new-hash",
        diskContent: "content",
        evolHash: "old-hash",
        evolId: "file-id-1",
      };

      const plan = planChangeCapture(state);

      expect(plan.some((a) => a.type === "LOG")).toBe(true);
    });
  });
});
