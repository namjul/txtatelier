import type { Evolu, EvoluSchema } from "@evolu/common";
import { useContext } from "solid-js";
import { EvoluContext } from "./EvoluContext.js";

/**
 * React Hook returning a generic instance of {@link Evolu}.
 *
 * This is intended for internal usage. Applications should use
 * {@link createUseEvolu}, which provides a correctly typed instance.
 */
export const useEvolu = (): Evolu<EvoluSchema> => {
  const evolu = useContext(EvoluContext);
  if (evolu == null) {
    throw new Error(
      "Could not find Evolu context value. Ensure the component is wrapped in an <EvoluProvider>.",
    );
  }
  return evolu as Evolu<EvoluSchema>;
};
