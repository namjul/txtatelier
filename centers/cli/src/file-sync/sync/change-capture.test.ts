import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sqliteTrue } from "@evolu/common";
import { MAX_FILE_SIZE_BYTES } from "../constants";
import { resetEvolu } from "../evolu";
import { defaultRelayUrl, startFileSync } from "../index";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "file-size-test-"));
  const dbPath = join(tempDir, "test.db");
  await resetEvolu(dbPath, defaultRelayUrl);
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("does not sync file over size limit by 1 byte", async () => {
  const session = await startFileSync({ watchDir: tempDir });

  const content = "a".repeat(MAX_FILE_SIZE_BYTES + 1); // 10MB + 1 byte
  await Bun.write(join(tempDir, "overlimit.txt"), content);
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const query = session.evolu.createQuery((db) =>
    db
      .selectFrom("file")
      .selectAll()
      .where("path", "==", "overlimit.txt" as never)
      .where("isDeleted", "is not", sqliteTrue as never),
  );
  const rows = await session.evolu.loadQuery(query);
  expect(rows).toHaveLength(0);

  await session.stop();
});

test("does not sync file way over size limit (50MB)", async () => {
  const session = await startFileSync({ watchDir: tempDir });

  const content = "a".repeat(50 * 1024 * 1024); // 50MB
  await Bun.write(join(tempDir, "huge.txt"), content);
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const query = session.evolu.createQuery((db) =>
    db
      .selectFrom("file")
      .selectAll()
      .where("path", "==", "huge.txt" as never)
      .where("isDeleted", "is not", sqliteTrue as never),
  );
  const rows = await session.evolu.loadQuery(query);
  expect(rows).toHaveLength(0);

  await session.stop();
});
