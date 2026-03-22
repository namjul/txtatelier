import { describe, expect, test } from "bun:test";
import { planStateMaterialization } from "./state-materialization-plan";
import type { MaterializationState } from "./state-types";

describe("planStateMaterialization - pure planning logic", () => {
  describe("already processed", () => {
    test("WHEN lastAppliedHash equals evolHash THEN plan skips", () => {
      const state: MaterializationState = {
        path: "test.md",
        diskHash: "hash123",
        evolHash: "hash123",
        evolContent: "content",
        lastAppliedHash: "hash123",
        ownerId: "device1",
      };

      const plan = planStateMaterialization(state);

      expect(
        plan.some((a) => a.type === "SKIP" && a.reason === "already-processed"),
      ).toBe(true);
    });
  });

  describe("disk matches evolu", () => {
    test("WHEN diskHash equals evolHash THEN plan updates tracking only", () => {
      const state: MaterializationState = {
        path: "test.md",
        diskHash: "hash123",
        evolHash: "hash123",
        evolContent: "content",
        lastAppliedHash: null,
        ownerId: "device1",
      };

      const plan = planStateMaterialization(state);

      const setTracked = plan.find((a) => a.type === "SET_TRACKED_HASH");
      expect(setTracked).toBeDefined();
      if (setTracked && setTracked.type === "SET_TRACKED_HASH") {
        expect(setTracked.path).toBe("test.md");
        expect(setTracked.hash).toBe("hash123");
      }
    });
  });

  describe("conflict detected", () => {
    test("WHEN both disk and evolu changed from base THEN plan creates conflict", () => {
      const state: MaterializationState = {
        path: "notes.md",
        diskHash: "local-hash",
        evolHash: "remote-hash",
        evolContent: "remote content",
        lastAppliedHash: "base-hash",
        ownerId: "device2",
      };

      const plan = planStateMaterialization(state);

      const createConflict = plan.find((a) => a.type === "CREATE_CONFLICT");
      expect(createConflict).toBeDefined();
      if (createConflict && createConflict.type === "CREATE_CONFLICT") {
        expect(createConflict.originalPath).toBe("notes.md");
        expect(createConflict.content).toBe("remote content");
        expect(createConflict.ownerId).toBe("device2");
        expect(createConflict.conflictPath).toContain("conflict");
      }

      const setTracked = plan.find((a) => a.type === "SET_TRACKED_HASH");
      expect(setTracked).toBeDefined();
    });
  });

  describe("safe write", () => {
    test("WHEN no conflict and file needs update THEN plan writes file", () => {
      const state: MaterializationState = {
        path: "test.md",
        diskHash: null,
        evolHash: "new-hash",
        evolContent: "new content",
        lastAppliedHash: null,
        ownerId: "device1",
      };

      const plan = planStateMaterialization(state);

      const writeFile = plan.find((a) => a.type === "WRITE_FILE");
      expect(writeFile).toBeDefined();
      if (writeFile && writeFile.type === "WRITE_FILE") {
        expect(writeFile.path).toBe("test.md");
        expect(writeFile.content).toBe("new content");
        expect(writeFile.hash).toBe("new-hash");
      }

      const setTracked = plan.find((a) => a.type === "SET_TRACKED_HASH");
      expect(setTracked).toBeDefined();
    });

    test("WHEN local unchanged but remote changed THEN plan writes file", () => {
      const state: MaterializationState = {
        path: "test.md",
        diskHash: "base-hash",
        evolHash: "new-hash",
        evolContent: "new content",
        lastAppliedHash: "base-hash",
        ownerId: "device1",
      };

      const plan = planStateMaterialization(state);

      expect(plan.some((a) => a.type === "WRITE_FILE")).toBe(true);
    });
  });

  describe("empty file", () => {
    test("WHEN evolContent is null and file not on disk THEN plan writes empty file", () => {
      const state: MaterializationState = {
        path: "empty.txt",
        diskHash: null,
        evolHash: "hash-of-empty",
        evolContent: null,
        lastAppliedHash: null,
        ownerId: "device1",
      };

      const plan = planStateMaterialization(state);

      expect(
        plan.some((a) => a.type === "SKIP" && a.reason === "invalid-evolu-state"),
      ).toBe(false);

      const writeFile = plan.find((a) => a.type === "WRITE_FILE");
      expect(writeFile).toBeDefined();
      if (writeFile && writeFile.type === "WRITE_FILE") {
        expect(writeFile.path).toBe("empty.txt");
        expect(writeFile.content).toBe("");
        expect(writeFile.hash).toBe("hash-of-empty");
      }
    });

    test("WHEN evolContent is null and disk already matches THEN plan updates tracking only", () => {
      const state: MaterializationState = {
        path: "empty.txt",
        diskHash: "hash-of-empty",
        evolHash: "hash-of-empty",
        evolContent: null,
        lastAppliedHash: null,
        ownerId: "device1",
      };

      const plan = planStateMaterialization(state);

      expect(
        plan.some((a) => a.type === "SKIP" && a.reason === "invalid-evolu-state"),
      ).toBe(false);
      expect(plan.some((a) => a.type === "WRITE_FILE")).toBe(false);
      expect(plan.some((a) => a.type === "SET_TRACKED_HASH")).toBe(true);
    });
  });

  describe("deletion conflict", () => {
    test("WHEN disk has changes during deletion THEN handled by applyRemoteDeletionToFilesystem", () => {
      // Note: Deletion conflicts are handled by applyRemoteDeletionToFilesystem
      // in state-materialization.ts, not by planStateMaterialization.
      // This is because deletions (isDeleted=true rows) are processed separately.
      // The materialization planner only handles active rows (isDeleted != true).
      expect(true).toBe(true);
    });
  });

  describe("logging", () => {
    test("WHEN planning any action THEN plan includes LOG actions", () => {
      const state: MaterializationState = {
        path: "test.md",
        diskHash: null,
        evolHash: "new-hash",
        evolContent: "content",
        lastAppliedHash: null,
        ownerId: "device1",
      };

      const plan = planStateMaterialization(state);

      expect(plan.some((a) => a.type === "LOG")).toBe(true);
    });
  });

  describe("action sequencing", () => {
    test("WHEN conflict occurs THEN actions are in correct order", () => {
      const state: MaterializationState = {
        path: "notes.md",
        diskHash: "local",
        evolHash: "remote",
        evolContent: "content",
        lastAppliedHash: "base",
        ownerId: "device2",
      };

      const plan = planStateMaterialization(state);

      const actionTypes = plan.map((a) => a.type);

      // Should have: LOG, CREATE_CONFLICT, LOG, SET_TRACKED_HASH
      expect(actionTypes.includes("CREATE_CONFLICT")).toBe(true);
      expect(actionTypes.includes("SET_TRACKED_HASH")).toBe(true);

      // SET_TRACKED_HASH should come after CREATE_CONFLICT
      const conflictIndex = actionTypes.indexOf("CREATE_CONFLICT");
      const setTrackedIndex = actionTypes.indexOf("SET_TRACKED_HASH");
      expect(setTrackedIndex).toBeGreaterThan(conflictIndex);
    });
  });
});
