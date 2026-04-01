import {
  createEvolu,
  type Evolu,
  type OwnerId,
  SimpleName,
} from "@evolu/common";
import { deriveShardOwner } from "@evolu/common/local-first";
import { evoluWebDeps } from "@evolu/web";
import { FILES_SHARD } from "@txtatelier/sync-invariants";
import { env } from "../env";
import { Schema } from "./schema";

export type TxtatelierEvolu = Evolu<typeof Schema>;

/**
 * Options for `file` table mutations. Matches CLI `filesOwnerId`
 * (`deriveShardOwner(appOwner, FILES_SHARD).id`). Required so PWA edits apply to the
 * same shard as CLI-created rows.
 */
export const getFilesShardMutationOptions = async (
  client: TxtatelierEvolu,
): Promise<{ readonly ownerId: OwnerId }> => {
  const owner = await client.appOwner;
  return { ownerId: deriveShardOwner(owner, FILES_SHARD).id };
};

export const defaultRelayUrl = "wss://free.evoluhq.com";

export const createEvoluClient = (
  transportUrl?: string,
): TxtatelierEvolu => {
  const trimmedTransportUrl = transportUrl?.trim() || defaultRelayUrl;
  const evolu = createEvolu(evoluWebDeps)(Schema, {
    name: SimpleName.orThrow("txtatelier"),
    transports: trimmedTransportUrl
      ? [{ type: "WebSocket" as const, url: trimmedTransportUrl }]
      : [],
    reloadUrl: env.basePath ?? "/",
  });

  // Use same shard owner as CLI for file sync compatibility (FILES_SHARD in sync-invariants)
  evolu.appOwner.then((owner) => {
    const filesShardOwner = deriveShardOwner(owner, FILES_SHARD);
    evolu.useOwner(filesShardOwner);
  });

  return evolu;
};

export const evolu = createEvoluClient(
  localStorage.getItem("transportUrl") ?? undefined,
);
