import { createEvolu, SimpleName } from "@evolu/common";
import { deriveShardOwner } from "@evolu/common/local-first";
import { evoluWebDeps } from "@evolu/web";
import { env } from "../env";
import { Schema } from "./schema";

export const defaultRelayUrl = "wss://free.evoluhq.com";

export const createEvoluClient = (transportUrl?: string) => {
  const trimmedTransportUrl = transportUrl?.trim() || defaultRelayUrl;
  const evolu = createEvolu(evoluWebDeps)(Schema, {
    name: SimpleName.orThrow("txtatelier"),
    transports: trimmedTransportUrl
      ? [{ type: "WebSocket" as const, url: trimmedTransportUrl }]
      : [],
    reloadUrl: env.basePath ?? "/",
  });

  // Use same shard owner as CLI for file sync compatibility
  // Shard path ["files", 1] matches CLI's filesShardOwner
  evolu.appOwner.then((owner) => {
    const filesShardOwner = deriveShardOwner(owner, ["files", 1]);
    evolu.useOwner(filesShardOwner);
  });

  return evolu;
};

export const evolu = createEvoluClient(
  localStorage.getItem("transportUrl") ?? undefined,
);
