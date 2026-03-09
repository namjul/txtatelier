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

// [ ]. Startup reconciliation - pre-existing files sync to Evolu
// [ ]. Loop A (FS→Evolu) - file changes propagate to database
// [ ]. Loop B (Evolu→FS) - remote changes write to disk
// [ ]. Conflict detection - concurrent edits create conflict files
// [ ]. Deletion handling - remote deletes vs local modifications
// [ ]. Session lifecycle - start/stop cleanup works correctly
// [ ]. Edge cases - ignored files, rapid changes, binary files

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "txtatelier-test-"));
  const dbPath = join(tempDir, "test.db");
  await resetEvolu(dbPath, defaultRelayUrl);
});

afterEach(async () => {
  // await rm(tempDir, { recursive: true, force: true });
});

describe("Startup reconciliation", () => {
  test("startFileSync returns session with stop method", async () => {
    const session = await startFileSync({ watchDir: tempDir });
    expect(session.stop).toBeFunction();
    await session.stop();
  });

  test("pre-existing files sync to Evolu on startup", async () => {
    // Create files before starting sync
    await Bun.write(join(tempDir, "existing.md"), "existing content");
    await Bun.write(join(tempDir, "another.md"), "another file");

    const session = await startFileSync({ watchDir: tempDir });

    // Wait for startup reconciliation to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check files were synced to Evolu
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

describe("Capture phase (FS→Evolu) - file changes propagate to database", () => {
  test("file creation syncs to Evolu", async () => {
    const session = await startFileSync({ watchDir: tempDir });

    // Wait for initial load to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Write a file to the filesystem
    await Bun.write(join(tempDir, "test.md"), "hello");

    // Wait for file watcher debounce + processing
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check file was synced to Evolu
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

describe("Materialize (Evolu→FS) - remote changes write to disk", () => {
  test("Evolu changes sync to filesystem", async () => {
    const session = await startFileSync({ watchDir: tempDir });

    // Wait for initial load to complete and subscription to be ready
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Upsert a file
    session.evolu.upsert("file", {
      id: createIdFromString("File"),
      path: NonEmptyString1000.orThrow("remote.md"),
      content: "from evolu",
      contentHash: NonEmptyString100.orThrow("fake-hash"),
    });

    // Wait for subscription debounce (500ms) + processing time
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Check file was written
    const content = await Bun.file(join(tempDir, "remote.md")).text();
    expect(content).toBe("from evolu");

    await session.stop();
  });
});

describe("Session lifecycle", () => {
  test("start and stop cleanup works correctly", async () => {
    const session = await startFileSync({ watchDir: tempDir });

    // Verify session has required methods
    expect(session.stop).toBeFunction();
    expect(session.evolu).toBeDefined();
    expect(session.flush).toBeFunction();

    // Create a test file
    await Bun.write(join(tempDir, "lifecycle.md"), "test content");
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Stop should complete without errors
    await session.stop();

    // Verify we can start again after stopping
    const session2 = await startFileSync({ watchDir: tempDir });
    expect(session2.stop).toBeFunction();
    await session2.stop();
  });
});

describe("File modifications", () => {
  test("file edits sync from FS to Evolu", async () => {
    const session = await startFileSync({ watchDir: tempDir });
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Create initial file
    await Bun.write(join(tempDir, "edit.md"), "original");
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Edit the file
    await Bun.write(join(tempDir, "edit.md"), "modified");
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check Evolu has the updated content
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

  test("file updates from Evolu sync to FS", async () => {
    const session = await startFileSync({ watchDir: tempDir });
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Create file via Evolu
    const fileId = createIdFromString("UpdateTestFile");
    session.evolu.upsert("file", {
      id: fileId,
      path: NonEmptyString1000.orThrow("update.md"),
      content: "version 1",
      contentHash: NonEmptyString100.orThrow("hash-v1"),
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Verify initial content
    let content = await Bun.file(join(tempDir, "update.md")).text();
    expect(content).toBe("version 1");

    // Update via Evolu
    session.evolu.upsert("file", {
      id: fileId,
      path: NonEmptyString1000.orThrow("update.md"),
      content: "version 2",
      contentHash: NonEmptyString100.orThrow("hash-v2"),
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Verify updated content
    content = await Bun.file(join(tempDir, "update.md")).text();
    expect(content).toBe("version 2");

    await session.stop();
  });
});


describe("Deletion handling", () => {
  test("file deletion syncs to Evolu", async () => {

    const session = await startFileSync({ watchDir: tempDir });
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Create file
    await Bun.write(join(tempDir, "delete.md"), "content");
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Delete file
    await Bun.file(join(tempDir, "delete.md")).unlink();
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check Evolu marks as deleted
    const query = session.evolu.createQuery((db) =>
      db.selectFrom("file").selectAll().where("path", "=", NonEmptyString1000.orThrow(
        "delete.md")),
    );
    const rows = await session.evolu.loadQuery(query);
    expect(rows[0]?.isDeleted).toBe(sqliteTrue);

    await session.stop();
  })

  test("remote deletion removes local file", async () => {
    const session = await startFileSync({ watchDir: tempDir });
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Create file via Evolu
    const fileId = createIdFromString("DeleteTestFile");
    session.evolu.upsert("file", {
      id: fileId,
      path: NonEmptyString1000.orThrow("remote-delete.md"),
      content: "will be deleted",
      contentHash: NonEmptyString100.orThrow("hash-delete"),
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Verify file exists
    let exists = await Bun.file(join(tempDir, "remote-delete.md")).exists();
    expect(exists).toBe(true);

    // Mark as deleted in Evolu
    session.evolu.update("file", {
      id: fileId,
      isDeleted: sqliteTrue,
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Verify file is removed
    exists = await Bun.file(join(tempDir, "remote-delete.md")).exists();
    expect(exists).toBe(false);

    await session.stop();
  });
});

