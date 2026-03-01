// Evolu schema definition for Phase 0: File table
// See IMPLEMENTATION_PLAN.md Phase 0 for schema specification

import * as Evolu from "@evolu/common";

// Primary key for File table
export const FileId = Evolu.id("File");
export type FileId = typeof FileId.Type;

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
};

export type Schema = typeof Schema;
