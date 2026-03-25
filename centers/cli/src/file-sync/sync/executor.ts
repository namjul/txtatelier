// Action executor - dispatches actions to I/O layer
// This is the ONLY place where side effects happen

import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { ok, type Result, sqliteTrue, tryAsync, trySync } from "@evolu/common";
import { logger } from "../../logger";
import {
  clearTrackedHash as clearTrackedHashState,
  setTrackedHash as setTrackedHashState,
} from "../state";
import { writeFileAtomic } from "../write";
import type { SyncAction } from "./actions";
import type { FileSyncContext } from "./context";

interface ExecutionError {
  readonly type: "ExecutionFailed";
  readonly action: SyncAction;
  readonly cause: unknown;
}

/**
 * Execute a single sync action.
 * Dispatches to appropriate I/O operation based on action type.
 *
 * @param ctx - Sync environment (database, watch root, files owner)
 * @param action - Action to execute
 * @returns Result of execution
 */
export const executeAction = async (
  ctx: FileSyncContext,
  action: SyncAction,
): Promise<Result<void, ExecutionError>> => {
  const { evolu, watchDir, filesOwnerId } = ctx;
  switch (action.type) {
    case "WRITE_FILE": {
      const absolutePath = join(watchDir, action.path);
      return tryAsync(
        () => writeFileAtomic(absolutePath, action.content),
        (cause): ExecutionError => ({
          type: "ExecutionFailed",
          action,
          cause,
        }),
      );
    }

    case "DELETE_FILE": {
      const absolutePath = join(watchDir, action.path);
      return tryAsync(
        () => unlink(absolutePath),
        (cause): ExecutionError => ({
          type: "ExecutionFailed",
          action,
          cause,
        }),
      );
    }

    case "CREATE_CONFLICT": {
      return tryAsync(
        () => writeFileAtomic(action.conflictPath, action.content),
        (cause): ExecutionError => ({
          type: "ExecutionFailed",
          action,
          cause,
        }),
      );
    }

    case "INSERT_EVOLU": {
      return trySync(
        () => {
          evolu.insert(
            "file",
            {
              path: action.path,
              content: action.content || null,
              contentHash: action.hash,
            },
            { ownerId: filesOwnerId },
          );
        },
        (cause): ExecutionError => ({
          type: "ExecutionFailed",
          action,
          cause,
        }),
      );
    }

    case "UPDATE_EVOLU": {
      return trySync(
        () => {
          evolu.update(
            "file",
            {
              id: action.id,
              path: action.path,
              content: action.content || null,
              contentHash: action.hash,
            },
            { ownerId: filesOwnerId },
          );
        },
        (cause): ExecutionError => ({
          type: "ExecutionFailed",
          action,
          cause,
        }),
      );
    }

    case "MARK_DELETED_EVOLU": {
      return trySync(
        () => {
          evolu.update(
            "file",
            {
              id: action.id,
              isDeleted: sqliteTrue,
            },
            { ownerId: filesOwnerId },
          );
        },
        (cause): ExecutionError => ({
          type: "ExecutionFailed",
          action,
          cause,
        }),
      );
    }

    case "SET_TRACKED_HASH": {
      const result = setTrackedHashState(evolu, action.path, action.hash);
      if (!result.ok) {
        return {
          ok: false,
          error: {
            type: "ExecutionFailed",
            action,
            cause: result.error,
          },
        };
      }
      return ok();
    }

    case "CLEAR_TRACKED_HASH": {
      const result = clearTrackedHashState(evolu, action.path);
      if (!result.ok) {
        return {
          ok: false,
          error: {
            type: "ExecutionFailed",
            action,
            cause: result.error,
          },
        };
      }
      return ok();
    }

    case "SKIP": {
      // No-op - already logged in plan
      return ok();
    }

    case "LOG": {
      logger[action.level](action.message);
      return ok();
    }
  }
};

/**
 * Execute a plan (sequence of actions).
 * Executes actions sequentially, continues on error.
 *
 * @param ctx - Sync environment (database, watch root, files owner)
 * @param actions - Array of actions to execute
 * @returns Array of results (one per action)
 */
export const executePlan = async (
  ctx: FileSyncContext,
  actions: readonly SyncAction[],
): Promise<readonly Result<void, ExecutionError>[]> => {
  const results: Result<void, ExecutionError>[] = [];

  for (const action of actions) {
    const result = await executeAction(ctx, action);
    results.push(result);

    // Continue executing even on error for resilience
  }

  return results;
};
