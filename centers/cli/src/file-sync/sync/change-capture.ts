// Change capture - filesystem → Evolu sync using plan-execute pattern
// Refactored to use: collect state → plan → execute

import { stat } from "node:fs/promises";
import { relative } from "node:path";
import { type Evolu, err, ok, type Result } from "@evolu/common";
import { logger } from "../../logger";
import { MAX_FILE_SIZE_BYTES } from "../constants";
import type { ChangeCaptureError } from "../errors";
import type { Schema } from "../evolu-schema";
import { planChangeCapture } from "./change-capture-plan";
import { executePlan } from "./executor";
import { collectChangeCaptureState } from "./state-collector";

type EvoluDatabase = Evolu<typeof Schema>;

/**
 * Format bytes to human-readable size using binary units (1024-based).
 * Examples: 1024 → "1.00KB", 10485760 → "10.00MB"
 */
const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)}KB`;
  }
  return `${bytes}B`;
};

/**
 * Capture filesystem changes and sync to Evolu.
 * Uses plan-execute pattern: collect state → plan actions → execute plan.
 *
 * @param evolu - Evolu database instance
 * @param watchDir - Watch directory
 * @param absolutePath - Absolute path to changed file
 * @returns Result of sync operation
 */
export const captureChange = async (
  evolu: EvoluDatabase,
  watchDir: string,
  absolutePath: string,
): Promise<Result<void, ChangeCaptureError>> => {
  const relativePath = relative(watchDir, absolutePath).replaceAll("\\", "/");

  // Safety checks for path validity
  if (
    relativePath === "" ||
    relativePath === "." ||
    relativePath.startsWith("../")
  ) {
    return ok();
  }

  // Check file size limit before collecting state
  const statResult = await stat(absolutePath).catch((error) => {
    const code = (error as { code?: string }).code;
    if (code === "ENOENT") {
      // File doesn't exist - that's ok, we'll handle deletion
      return null;
    }
    throw error;
  });

  if (statResult && !statResult.isFile()) {
    // Not a file (directory, symlink, etc.) - skip
    return ok();
  }

  if (statResult && statResult.size > MAX_FILE_SIZE_BYTES) {
    logger.warn(
      `[capture:fs→evolu] File too large: ${absolutePath} ` +
        `(${formatBytes(statResult.size)} > ${formatBytes(MAX_FILE_SIZE_BYTES)}) - skipped`,
    );
    return err({
      type: "FileTooLarge",
      absolutePath,
      sizeBytes: statResult.size,
      maxSizeBytes: MAX_FILE_SIZE_BYTES,
    });
  }

  // Step 1: Collect state (I/O)
  const stateResult = await collectChangeCaptureState(
    evolu,
    watchDir,
    absolutePath,
  );

  if (!stateResult.ok) {
    logger.error(
      `[capture:fs→evolu] Failed to collect state for ${absolutePath}:`,
      stateResult.error,
    );
    return err({
      type: "FileStatFailed",
      absolutePath,
      cause: stateResult.error,
    });
  }

  // Step 2: Plan actions (pure logic)
  const plan = planChangeCapture(stateResult.value);

  // Step 3: Execute plan (I/O)
  const results = await executePlan(evolu, watchDir, plan);

  // Check for execution errors
  const firstError = results.find((r) => !r.ok);
  if (firstError && !firstError.ok) {
    logger.error(
      `[capture:fs→evolu] Execution failed for ${absolutePath}:`,
      firstError.error,
    );
    return err({
      type: "EvoluMutationFailed",
      relativePath,
      cause: firstError.error,
    });
  }

  return ok();
};
