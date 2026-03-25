import type { Evolu } from "@evolu/common";
import type { OwnerId } from "@evolu/common/local-first";
import type { Schema } from "../evolu-schema";

export type EvoluDatabase = Evolu<typeof Schema>;

export interface FileSyncContext {
  readonly evolu: EvoluDatabase;
  readonly watchDir: string;
  readonly filesOwnerId: OwnerId;
}
