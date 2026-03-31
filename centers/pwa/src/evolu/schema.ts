import {
  String as EvoluString,
  id,
  NonEmptyString100,
  NonEmptyString1000,
  nullOr,
} from "@evolu/common";

export const FileId = id("File");
export type FileId = typeof FileId.Type;

export const SettingsId = id("Settings");
export type SettingsId = typeof SettingsId.Type;

export const Schema = {
  file: {
    id: FileId,
    path: NonEmptyString1000,
    content: nullOr(EvoluString),
    contentHash: NonEmptyString100,
  },

  // Local-only (underscore prefix); inbox path is per-device, not replicated
  _settings: {
    id: SettingsId,
    inboxPath: NonEmptyString1000,
  },
};

export type Schema = typeof Schema;
