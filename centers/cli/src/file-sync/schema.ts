// Evolu schema definition
// Phase 0: File table (synced)
// Phase 1: _syncState table (local-only, not synced)

import * as Evolu from "@evolu/common";

// Primary keys
export const FileId = Evolu.id("File");
export type FileId = typeof FileId.Type;

export const SyncStateId = Evolu.id("SyncState");
export type SyncStateId = typeof SyncStateId.Type;

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
  // Used by Loop B to track which hashes we've applied to disk
  _syncState: {
    id: SyncStateId,
    // File path (matches file.path)
    path: Evolu.NonEmptyString1000,
    // Last hash we wrote to the filesystem
    // Used to detect conflicts (local changes vs remote changes)
    lastAppliedHash: Evolu.NonEmptyString100,
  },
};

export type Schema = typeof Schema;
