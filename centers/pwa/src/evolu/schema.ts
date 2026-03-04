import {
  String as EvoluString,
  id,
  NonEmptyString100,
  NonEmptyString1000,
  nullOr,
} from "@evolu/common";

export const FileId = id("File");
export type FileId = typeof FileId.Type;

export const Schema = {
  file: {
    id: FileId,
    path: NonEmptyString1000,
    content: nullOr(EvoluString),
    contentHash: NonEmptyString100,
  },
};

export type Schema = typeof Schema;
