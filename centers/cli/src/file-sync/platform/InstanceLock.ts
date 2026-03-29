import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { ok, type Result, tryAsync } from "@evolu/common";
import envPaths from "env-paths";
import lockfile from "proper-lockfile";

const txtatelierPaths = envPaths("txtatelier");

/** Stable path under local cache — avoids cloud-sync dirs (e.g. Dropbox) breaking lock mkdir/rmdir. */
const lockfilePathForWatchDir = (watchDir: string): string => {
  const h = createHash("sha256")
    .update(resolve(watchDir))
    .digest("hex")
    .slice(0, 8);
  return join(txtatelierPaths.cache, "instance-locks", `${h}.lock`);
};

export type InstanceLockError =
  | {
      readonly type: "AlreadyLocked";
      readonly lockedPath: string;
      readonly pid?: number;
    }
  | { readonly type: "LockFailed"; readonly cause: Error };

export type InstanceLock = {
  readonly acquire: () => Promise<Result<void, InstanceLockError>>;
  readonly release: () => Promise<void>;
};

/**
 * User-facing message when the watch directory is already locked by another instance.
 */
export const formatDuplicateInstanceMessage = (
  watchDir: string,
  error: InstanceLockError,
): string => {
  if (error.type === "AlreadyLocked") {
    const pidLine =
      error.pid != null
        ? `If that process is txtatelier, stop it with: kill ${error.pid}`
        : "Stop the other txtatelier process, or wait for a stale lock to expire (~10s after a crash).";
    return [
      "[txtatelier] Another instance appears to be using this watch directory:",
      `  ${watchDir}`,
      pidLine,
      "Or use a different directory, e.g. txtatelier --watch-dir <path>",
    ].join("\n");
  }
  return `[txtatelier] Could not acquire instance lock: ${error.cause.message}`;
};

/**
 * Exclusive lock for a single txtatelier process per resolved watch directory.
 * Lock file lives under OS app cache (not next to the watch dir) so cloud-synced
 * folders do not break atomic mkdir/rmdir.
 */
export const createInstanceLock = (watchDir: string): InstanceLock => {
  let unlock: (() => Promise<void>) | null = null;
  const lockfilePath = lockfilePathForWatchDir(watchDir);

  return {
    acquire: async (): Promise<Result<void, InstanceLockError>> => {
      if (unlock != null) {
        return ok(undefined);
      }
      return tryAsync(
        async () => {
          await mkdir(dirname(lockfilePath), { recursive: true });
          unlock = await lockfile.lock(watchDir, {
            stale: 10_000,
            lockfilePath,
            onCompromised: (compromiseError: Error) => {
              console.error(
                "[txtatelier] Instance lock compromised:",
                compromiseError.message,
              );
            },
          });
        },
        (cause): InstanceLockError => {
          const e = cause as Error & { code?: string; file?: string };
          if (e.code === "ELOCKED") {
            return {
              type: "AlreadyLocked",
              lockedPath: e.file ?? watchDir,
            };
          }
          return { type: "LockFailed", cause: e };
        },
      );
    },

    release: async (): Promise<void> => {
      if (unlock == null) {
        return;
      }
      const releaseLock = unlock;
      unlock = null;
      await releaseLock();

      console.log("released");
      return undefined
    },
  };
};
