import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createInstanceLock } from "./InstanceLock";

describe("createInstanceLock", () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir === undefined) return;
    await createInstanceLock(dir).release();
  });

  test("acquire succeeds then second acquire on same dir fails with AlreadyLocked", async () => {
    dir = await mkdtemp(join(tmpdir(), "txtatelier-lock-"));
    const a = createInstanceLock(dir);
    const b = createInstanceLock(dir);
    const first = await a.acquire();
    expect(first.ok).toBe(true);
    const second = await b.acquire();
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.type).toBe("AlreadyLocked");
    await a.release();
    const third = await b.acquire();
    expect(third.ok).toBe(true);
    if (third.ok) await b.release();
  });

  test("release allows re-acquire on same directory", async () => {
    dir = await mkdtemp(join(tmpdir(), "txtatelier-lock-"));
    const lock = createInstanceLock(dir);
    expect((await lock.acquire()).ok).toBe(true);
    await lock.release();
    expect((await lock.acquire()).ok).toBe(true);
    await lock.release();
  });
});
