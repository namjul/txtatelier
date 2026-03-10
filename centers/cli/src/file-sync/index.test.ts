import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createIdFromString,
  NonEmptyString100,
  NonEmptyString1000,
  sqliteTrue,
} from "@evolu/common";
import { resetEvolu } from "./evolu";
import { defaultRelayUrl, startFileSync } from "./index";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "txtatelier-test-"));
  const dbPath = join(tempDir, "test.db");
  await resetEvolu(dbPath, defaultRelayUrl);
});

afterEach(async () => {
  // await rm(tempDir, { recursive: true, force: true });
});

describe("GIVEN clean workspace", () => {
  describe("WHEN startFileSync is called", () => {
    test("THEN session with stop method is returned", async () => {
      const session = await startFileSync({ watchDir: tempDir });
      expect(session.stop).toBeFunction();
      expect(session.evolu).toBeDefined();
      expect(session.flush).toBeFunction();
      await session.stop();
    });
  });

  describe("WHEN session is started and stopped", () => {
    test("THEN session can be restarted", async () => {
      const session1 = await startFileSync({ watchDir: tempDir });
      await Bun.write(join(tempDir, "lifecycle.md"), "test content");
      await new Promise((resolve) => setTimeout(resolve, 500));
      await session1.stop();

      const session2 = await startFileSync({ watchDir: tempDir });
      expect(session2.stop).toBeFunction();
      await session2.stop();
    });
  });
});

describe("GIVEN files exist on disk before sync starts", () => {
  beforeEach(async () => {
    await Bun.write(join(tempDir, "existing.md"), "existing content");
    await Bun.write(join(tempDir, "another.md"), "another file");
  });

  describe("WHEN sync is started", () => {
    test("THEN pre-existing files sync to Evolu", async () => {
      const session = await startFileSync({ watchDir: tempDir });
      await new Promise((resolve) => setTimeout(resolve, 500));

      const query = session.evolu.createQuery((db) =>
        db.selectFrom("file").selectAll(),
      );
      const rows = await session.evolu.loadQuery(query);

      expect(rows.length).toBeGreaterThanOrEqual(2);
      const paths = rows.map((r) => r.path);
      expect(paths).toContain(NonEmptyString1000.orThrow("existing.md"));
      expect(paths).toContain(NonEmptyString1000.orThrow("another.md"));

      await session.stop();
    });
  });
});

describe("GIVEN sync is running", () => {
  describe("WHEN file is created on disk", () => {
    test("THEN file syncs to Evolu", async () => {
      const session = await startFileSync({ watchDir: tempDir });
      await new Promise((resolve) => setTimeout(resolve, 500));

      await Bun.write(join(tempDir, "test.md"), "hello");
      await new Promise((resolve) => setTimeout(resolve, 500));

      const query = session.evolu.createQuery((db) =>
        db
          .selectFrom("file")
          .selectAll()
          .where("path", "=", NonEmptyString1000.orThrow("test.md")),
      );
      const rows = await session.evolu.loadQuery(query);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.content).toBe("hello");

      await session.stop();
    });
  });

  describe("WHEN file is edited on disk", () => {
    test("THEN changes sync to Evolu", async () => {
      const session = await startFileSync({ watchDir: tempDir });
      await new Promise((resolve) => setTimeout(resolve, 500));

      await Bun.write(join(tempDir, "edit.md"), "original");
      await new Promise((resolve) => setTimeout(resolve, 500));

      await Bun.write(join(tempDir, "edit.md"), "modified");
      await new Promise((resolve) => setTimeout(resolve, 500));

      const query = session.evolu.createQuery((db) =>
        db
          .selectFrom("file")
          .selectAll()
          .where("path", "=", NonEmptyString1000.orThrow("edit.md")),
      );
      const rows = await session.evolu.loadQuery(query);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.content).toBe("modified");

      await session.stop();
    });
  });

  describe("WHEN file is deleted on disk", () => {
    test("THEN deletion syncs to Evolu", async () => {
      const session = await startFileSync({ watchDir: tempDir });
      await new Promise((resolve) => setTimeout(resolve, 500));

      await Bun.write(join(tempDir, "delete.md"), "content");
      await new Promise((resolve) => setTimeout(resolve, 500));

      await Bun.file(join(tempDir, "delete.md")).unlink();
      await new Promise((resolve) => setTimeout(resolve, 500));

      const query = session.evolu.createQuery((db) =>
        db
          .selectFrom("file")
          .selectAll()
          .where("path", "=", NonEmptyString1000.orThrow("delete.md")),
      );
      const rows = await session.evolu.loadQuery(query);
      expect(rows[0]?.isDeleted).toBe(sqliteTrue);

      await session.stop();
    });
  });

  describe("WHEN file is created in Evolu", () => {
    test("THEN file syncs to disk", async () => {
      const session = await startFileSync({ watchDir: tempDir });
      await new Promise((resolve) => setTimeout(resolve, 500));

      session.evolu.upsert("file", {
        id: createIdFromString("File"),
        path: NonEmptyString1000.orThrow("remote.md"),
        content: "from evolu",
        contentHash: NonEmptyString100.orThrow("fake-hash"),
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const content = await Bun.file(join(tempDir, "remote.md")).text();
      expect(content).toBe("from evolu");

      await session.stop();
    });
  });

  describe("WHEN file is updated in Evolu", () => {
    test("THEN updates sync to disk", async () => {
      const session = await startFileSync({ watchDir: tempDir });
      await new Promise((resolve) => setTimeout(resolve, 500));

      const fileId = createIdFromString("UpdateTestFile");
      session.evolu.upsert("file", {
        id: fileId,
        path: NonEmptyString1000.orThrow("update.md"),
        content: "version 1",
        contentHash: NonEmptyString100.orThrow("hash-v1"),
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      let content = await Bun.file(join(tempDir, "update.md")).text();
      expect(content).toBe("version 1");

      session.evolu.upsert("file", {
        id: fileId,
        path: NonEmptyString1000.orThrow("update.md"),
        content: "version 2",
        contentHash: NonEmptyString100.orThrow("hash-v2"),
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      content = await Bun.file(join(tempDir, "update.md")).text();
      expect(content).toBe("version 2");

      await session.stop();
    });
  });

  describe("WHEN file is deleted in Evolu", () => {
    test("THEN file is removed from disk", async () => {
      const session = await startFileSync({ watchDir: tempDir });
      await new Promise((resolve) => setTimeout(resolve, 500));

      const fileId = createIdFromString("DeleteTestFile");
      session.evolu.upsert("file", {
        id: fileId,
        path: NonEmptyString1000.orThrow("remote-delete.md"),
        content: "will be deleted",
        contentHash: NonEmptyString100.orThrow("hash-delete"),
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      let exists = await Bun.file(join(tempDir, "remote-delete.md")).exists();
      expect(exists).toBe(true);

      session.evolu.update("file", {
        id: fileId,
        isDeleted: sqliteTrue,
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      exists = await Bun.file(join(tempDir, "remote-delete.md")).exists();
      expect(exists).toBe(false);

      await session.stop();
    });
  });
});

describe("GIVEN file exists in both Evolu and disk", () => {
  let session1: Awaited<ReturnType<typeof startFileSync>>;

  beforeEach(async () => {
    await Bun.write(join(tempDir, "synced.md"), "synced content");
    session1 = await startFileSync({ watchDir: tempDir });
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe("WHEN file is deleted in Evolu while offline", () => {
    test.todo("THEN file is removed on next startup", async () => {});
  });

  describe("WHEN file is added to Evolu while offline", () => {
    test.todo("THEN file is written to disk on startup", () => {});
  });

  describe("WHEN file is modified on disk while offline", () => {
    test.todo("THEN changes sync to Evolu on startup", () => {});
  });

  describe("WHEN file is edited in both Evolu and disk while offline", () => {
    test.todo("THEN conflict file is created on startup", () => {});
  });

  describe("WHEN file is deleted in Evolu and edited on disk while offline", () => {
    test.todo("THEN conflict is detected on startup", () => {});
  });

  describe("WHEN file is edited in Evolu and deleted on disk while offline", () => {
    test.todo("THEN remote edit is applied on startup", () => {});
  });
});
