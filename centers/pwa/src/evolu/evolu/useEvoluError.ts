import type { EvoluError } from "@evolu/common";
import type { Accessor } from "solid-js";
import { createSignal, onCleanup } from "solid-js";
import { useEvolu } from "./useEvolu.js";

/** Subscribe to {@link EvoluError} changes as a Solid {@link Accessor}. */
export const useEvoluError = (): Accessor<EvoluError | null> => {
  const evolu = useEvolu();
  const [error, setError] = createSignal<EvoluError | null>(evolu.getError());
  onCleanup(
    evolu.subscribeError(() => {
      setError(evolu.getError());
    }),
  );
  return error;
};
