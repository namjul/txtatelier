import type { SyncOwner } from "@evolu/common";
import { createEffect } from "solid-js";
import { useEvolu } from "./useEvolu.js";

/**
 * Solid hook for Evolu `useOwner` method.
 *
 * Using an owner means syncing it with its transports, or the transports
 * defined in Evolu config if the owner has no transports defined.
 */
export const useOwner = (owner: SyncOwner | null): void => {
  const evolu = useEvolu();
  createEffect(() => {
    if (owner == null) return;
    return evolu.useOwner(owner);
  });
};
