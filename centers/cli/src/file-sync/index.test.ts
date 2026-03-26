// biome-ignore-all lint/style/noNonNullAssertion: reason

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { access, mkdtemp, readFile, unlink, writeFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createIdFromString,
  NonEmptyString100,
  NonEmptyString1000,
  sqliteTrue,
} from "@evolu/common";
import { resetEvolu } from "./evolu";
import { defaultRelayUrl, type FileSyncSession, startFileSync } from "./index";

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
      const result = await startFileSync({ watchDir: tempDir });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const session = result.value;
      expect(typeof session.stop).toBe("function");
      expect(session.evolu).toBeDefined();
      expect(typeof session.flush).toBe("function");
      expect(session.failedSyncs).toBeDefined();
      expect(session.failedSyncs.size).toBe(0);
      await session.stop();
    });
  });

  describe("WHEN session is started and stopped", () => {
    test("THEN session can be restarted", async () => {
      const result1 = await startFileSync({ watchDir: tempDir });
      expect(result1.ok).toBe(true);
      if (!result1.ok) return;
      const session1 = result1.value;
      await writeFile(join(tempDir, "lifecycle.txt"), "test content");
      await new Promise((resolve) => setTimeout(resolve, 500));
      await session1.stop();

      const result2 = await startFileSync({ watchDir: tempDir });

      expect(result2.ok).toBe(true);

      if (!result2.ok) return;

      const session2 = result2.value;
      expect(typeof session2.stop).toBe("function");
      await session2.stop();
    });
  });
});

describe("GIVEN files exist on disk before sync starts", () => {
  beforeEach(async () => {
    await writeFile(join(tempDir, "existing.txt"), "existing content");
    await writeFile(join(tempDir, "another.txt"), "another file");
  });

  describe("WHEN sync is started", () => {
    test("THEN pre-existing files sync to Evolu", async () => {
      const result = await startFileSync({ watchDir: tempDir });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const session = result.value;
      await new Promise((resolve) => setTimeout(resolve, 500));

      const query = session.evolu.createQuery((db) =>
        db.selectFrom("file").selectAll(),
      );
      const rows = await session.evolu.loadQuery(query);

      expect(rows.length).toBeGreaterThanOrEqual(2);
      const paths = rows.map((r) => r.path);
      expect(paths).toContain(NonEmptyString1000.orThrow("existing.txt"));
      expect(paths).toContain(NonEmptyString1000.orThrow("another.txt"));

      await session.stop();
    });
  });
});

describe("GIVEN sync is running", () => {
  describe("WHEN file is created on disk", () => {
    test("THEN file syncs to Evolu", async () => {
      const result = await startFileSync({ watchDir: tempDir });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const session = result.value;
      await new Promise((resolve) => setTimeout(resolve, 500));

      await writeFile(join(tempDir, "test.txt"), "hello");
      await new Promise((resolve) => setTimeout(resolve, 500));

      const query = session.evolu.createQuery((db) =>
        db
          .selectFrom("file")
          .selectAll()
          .where("path", "=", NonEmptyString1000.orThrow("test.txt")),
      );
      const rows = await session.evolu.loadQuery(query);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.content).toBe("hello");

      await session.stop();
    });
  });

  describe("WHEN file is edited on disk", () => {
    test("THEN changes sync to Evolu", async () => {
      const result = await startFileSync({ watchDir: tempDir });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const session = result.value;
      await new Promise((resolve) => setTimeout(resolve, 500));

      await writeFile(join(tempDir, "edit.txt"), "original");
      await new Promise((resolve) => setTimeout(resolve, 500));

      await writeFile(join(tempDir, "edit.txt"), "modified");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const query = session.evolu.createQuery((db) =>
        db
          .selectFrom("file")
          .selectAll()
          .where("path", "=", NonEmptyString1000.orThrow("edit.txt")),
      );
      const rows = await session.evolu.loadQuery(query);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.content).toBe("modified");

      await session.stop();
    });
  });

  describe("WHEN file is deleted on disk", () => {
    test("THEN deletion syncs to Evolu", async () => {
      const result = await startFileSync({ watchDir: tempDir });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const session = result.value;
      await new Promise((resolve) => setTimeout(resolve, 500));

      await writeFile(join(tempDir, "delete.txt"), "content");
      await new Promise((resolve) => setTimeout(resolve, 500));

      await unlink(join(tempDir, "delete.txt"));
      await new Promise((resolve) => setTimeout(resolve, 500));

      const query = session.evolu.createQuery((db) =>
        db
          .selectFrom("file")
          .selectAll()
          .where("path", "=", NonEmptyString1000.orThrow("delete.txt")),
      );
      const rows = await session.evolu.loadQuery(query);
      expect(rows[0]?.isDeleted).toBe(sqliteTrue);

      await session.stop();
    });
  });

  describe("WHEN file is created in Evolu", () => {
    test("THEN file syncs to disk", async () => {
      const result = await startFileSync({ watchDir: tempDir });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const session = result.value;
      await new Promise((resolve) => setTimeout(resolve, 500));

      session.evolu.upsert("file", {
        id: createIdFromString("File"),
        path: NonEmptyString1000.orThrow("remote.txt"),
        content: "from evolu",
        contentHash: NonEmptyString100.orThrow("fake-hash"),
      }, { ownerId: session.filesShardOwner.id });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const content = await readFile(join(tempDir, "remote.txt"), "utf-8");
      expect(content).toBe("from evolu");

      await session.stop();
    });
  });

  describe("WHEN file is updated in Evolu", () => {
    test("THEN updates sync to disk", async () => {
      const result = await startFileSync({ watchDir: tempDir });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const session = result.value;
      await new Promise((resolve) => setTimeout(resolve, 500));

      const fileId = createIdFromString("UpdateTestFile");
      session.evolu.upsert("file", {
        id: fileId,
        path: NonEmptyString1000.orThrow("update.txt"),
        content: "version 1",
        contentHash: NonEmptyString100.orThrow("hash-v1"),
      }, { ownerId: session.filesShardOwner.id });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      let content = await readFile(join(tempDir, "update.txt"), "utf-8");
      expect(content).toBe("version 1");

      session.evolu.upsert("file", {
        id: fileId,
        path: NonEmptyString1000.orThrow("update.txt"),
        content: "version 2",
        contentHash: NonEmptyString100.orThrow("hash-v2"),
      }, { ownerId: session.filesShardOwner.id });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      content = await readFile(join(tempDir, "update.txt"), "utf-8");
      expect(content).toBe("version 2");

      await session.stop();
    });
  });

  describe("WHEN file is deleted in Evolu", () => {
    test("THEN file is removed from disk", async () => {
      const result = await startFileSync({ watchDir: tempDir });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const session = result.value;
      await new Promise((resolve) => setTimeout(resolve, 500));

      const fileId = createIdFromString("DeleteTestFile");
      session.evolu.upsert("file", {
        id: fileId,
        path: NonEmptyString1000.orThrow("remote-delete.txt"),
        content: "will be deleted",
        contentHash: NonEmptyString100.orThrow("hash-delete"),
      }, { ownerId: session.filesShardOwner.id });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      let exists = await access(join(tempDir, "remote-delete.txt")).then(
        () => true,
        () => false,
      );
      expect(exists).toBe(true);

      session.evolu.update("file", {
        id: fileId,
        isDeleted: sqliteTrue,
      }, { ownerId: session.filesShardOwner.id });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      exists = await access(join(tempDir, "remote-delete.txt")).then(
        () => true,
        () => false,
      );
      expect(exists).toBe(false);

      await session.stop();
    });
  });
});

describe("GIVEN file exists in both Evolu and disk", () => {
  let session1: FileSyncSession;

  beforeEach(async () => {
    await writeFile(join(tempDir, "synced.txt"), "synced content");
    const result1 = await startFileSync({ watchDir: tempDir });

    if (!result1.ok) throw new Error("Failed to start");

    session1 = result1.value;
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe.skip("WHEN file is deleted in Evolu while offline", () => {
    test("THEN file is removed on next startup", async () => {
      const query = session1.evolu.createQuery((db) =>
        db
          .selectFrom("file")
          .selectAll()
          .where("path", "=", NonEmptyString1000.orThrow("synced.txt")),
      );
      const rows = await session1.evolu.loadQuery(query);
      const fileId = rows[0]?.id;

      session1.evolu.update("file", { id: fileId!, isDeleted: sqliteTrue }, { ownerId: session1.filesShardOwner.id });
      await session1.flush();
      await session1.stop();

      const result2 = await startFileSync({ watchDir: tempDir });

      expect(result2.ok).toBe(true);

      if (!result2.ok) return;

      const session2 = result2.value;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const exists = await access(join(tempDir, "synced.txt")).then(
        () => true,
        () => false,
      );
      expect(exists).toBe(false);
      await session2.stop();
    });
  });

  describe.skip("WHEN file is added to Evolu while offline", () => {
    test("THEN file is written to disk on startup", async () => {
      session1.evolu.upsert("file", {
        id: createIdFromString("OfflineAddTest"),
        path: NonEmptyString1000.orThrow("offline-new.txt"),
        content: "added offline",
        contentHash: NonEmptyString100.orThrow("hash-offline"),
      }, { ownerId: session1.filesShardOwner.id });
      await session1.flush();
      await session1.stop();

      const result2 = await startFileSync({ watchDir: tempDir });

      expect(result2.ok).toBe(true);

      if (!result2.ok) return;

      const session2 = result2.value;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const content = await readFile(
        join(tempDir, "offline-new.txt"),
        "utf-8",
      );
      expect(content).toBe("added offline");
      await session2.stop();
    });
  });

  describe("WHEN file is modified on disk while offline", () => {
    test("THEN changes sync to Evolu on startup", async () => {
      await session1.stop();

      await writeFile(join(tempDir, "synced.txt"), "modified offline");

      const result2 = await startFileSync({ watchDir: tempDir });

      expect(result2.ok).toBe(true);

      if (!result2.ok) return;

      const session2 = result2.value;
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const query = session2.evolu.createQuery((db) =>
        db
          .selectFrom("file")
          .selectAll()
          .where("path", "=", NonEmptyString1000.orThrow("synced.txt")),
      );
      const rows = await session2.evolu.loadQuery(query);
      expect(rows[0]?.content).toBe("modified offline");
      await session2.stop();
    });
  });

  describe("WHEN file is edited in both Evolu and disk while offline", () => {
    test("THEN conflict file is created on startup", async () => {
      const query = session1.evolu.createQuery((db) =>
        db
          .selectFrom("file")
          .selectAll()
          .where("path", "=", NonEmptyString1000.orThrow("synced.txt")),
      );
      const rows = await session1.evolu.loadQuery(query);
      const fileId = rows[0]?.id;

      session1.evolu.upsert("file", {
        id: fileId!,
        path: NonEmptyString1000.orThrow("synced.txt"),
        content: "evolu edit",
        contentHash: NonEmptyString100.orThrow("hash-conflict"),
      }, { ownerId: session1.filesShardOwner.id });
      await session1.flush();
      await session1.stop();

      await writeFile(join(tempDir, "synced.txt"), "disk edit");

      const result2 = await startFileSync({ watchDir: tempDir });

      expect(result2.ok).toBe(true);

      if (!result2.ok) return;

      const session2 = result2.value;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const allFiles = await readdir(tempDir);
      const conflictFiles = allFiles.filter((f) =>
        f.startsWith("synced.conflict"),
      );
      expect(conflictFiles.length).toBeGreaterThan(0);
      await session2.stop();
    });
  });

  describe("WHEN file is deleted in Evolu and edited on disk while offline", () => {
    test("THEN conflict is detected on startup", async () => {
      const query = session1.evolu.createQuery((db) =>
        db
          .selectFrom("file")
          .selectAll()
          .where("path", "=", NonEmptyString1000.orThrow("synced.txt")),
      );
      const rows = await session1.evolu.loadQuery(query);
      const fileId = rows[0]?.id;

      session1.evolu.update("file", {
        id: fileId!,
        isDeleted: sqliteTrue,
      }, { ownerId: session1.filesShardOwner.id });
      await session1.flush();
      await session1.stop();

      await writeFile(join(tempDir, "synced.txt"), "disk edit");

      const result2 = await startFileSync({ watchDir: tempDir });

      expect(result2.ok).toBe(true);

      if (!result2.ok) return;

      const session2 = result2.value;
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const allFiles = await readdir(tempDir);
      const conflictFiles = allFiles.filter((f) =>
        f.startsWith("synced.conflict"),
      );
      expect(conflictFiles.length).toBeGreaterThan(0);

      await session2.stop();
    });
  });

  describe("WHEN file is edited in Evolu and deleted on disk while offline", () => {
    test("THEN remote edit is applied on startup", async () => {
      const query = session1.evolu.createQuery((db) =>
        db
          .selectFrom("file")
          .selectAll()
          .where("path", "=", NonEmptyString1000.orThrow("synced.txt")),
      );
      const rows = await session1.evolu.loadQuery(query);
      const fileId = rows[0]?.id;

      session1.evolu.upsert("file", {
        id: fileId!,
        path: NonEmptyString1000.orThrow("synced.txt"),
        content: "evolu edit",
        contentHash: NonEmptyString100.orThrow("hash-conflict"),
      }, { ownerId: session1.filesShardOwner.id });
      await session1.flush();
      await session1.stop();

      await unlink(join(tempDir, "synced.txt"));

      const result2 = await startFileSync({ watchDir: tempDir });

      expect(result2.ok).toBe(true);

      if (!result2.ok) return;

      const session2 = result2.value;
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const query2 = session2.evolu.createQuery((db) =>
        db
          .selectFrom("file")
          .selectAll()
          .where("path", "=", NonEmptyString1000.orThrow("synced.txt")),
      );
      const rows2 = await session2.evolu.loadQuery(query2);
      expect(rows2).toHaveLength(1);
      expect(rows2[0]?.content).toBe("evolu edit");

      await session2.stop();
    });
  });
});
