// Evolu schema definition
// Phase 0: File table (synced)
// Phase 1: _syncState table (local-only, not synced)
// Phase 2: _historyCursor table (local-only, incremental sync)

import * as Evolu from "@evolu/common";
import { TimestampBytes } from "@evolu/common/local-first";

// Primary keys
export const FileId = Evolu.id("File");
export type FileId = typeof FileId.Type;

export const SyncStateId = Evolu.id("SyncState");
export type SyncStateId = typeof SyncStateId.Type;

export const HistoryCursorId = Evolu.id("HistoryCursor");
export type HistoryCursorId = typeof HistoryCursorId.Type;

// Schema definition
export const Schema = {
  file: {
    id: FileId,
    // File path (unique identifier)
    // Max 1000 chars (safe for all platforms: Linux PATH_MAX=4096, Windows MAX_PATH=260)
    path: Evolu.NonEmptyString1000,
    // File content (nullable to support empty files)
    content: Evolu.nullOr(Evolu.String),
    // Content hash for change detection
    // Using NonEmptyString100 (sufficient for SHA-256 hex = 64 chars, or BLAKE3 = 64 chars)
    contentHash: Evolu.NonEmptyString100,
    // System columns auto-added by Evolu:
    // - createdAt: Timestamp
    // - updatedAt: Timestamp
    // - isDeleted: SqliteBoolean
    // - ownerId: OwnerId
  },

  // Local-only table for tracking filesystem sync state
  // Underscore prefix (_) prevents sync across devices
  // Used by state materialization to track which hashes were applied to disk
  _syncState: {
    id: SyncStateId,
    // File path (matches file.path)
    path: Evolu.NonEmptyString1000,
    // Last hash we wrote to the filesystem
    // Used to detect conflicts (local changes vs remote changes)
    lastAppliedHash: Evolu.NonEmptyString100,
  },

  // Local-only table for incremental sync cursor
  // Tracks last processed evolu_history timestamp for this device
  // Always contains exactly 1 row (device's bookmark in history stream)
  _historyCursor: {
    id: HistoryCursorId,
    // Last evolu_history timestamp we processed
    // Used to query: WHERE timestamp > lastTimestamp
    lastTimestamp: Evolu.nullOr(TimestampBytes),
  },
};

export type Schema = typeof Schema;
