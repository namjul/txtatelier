import type { Evolu, EvoluSchema } from "@evolu/common";
import { useEvolu } from "./useEvolu.js";

/**
 * Creates a typed Solid hook returning an instance of {@link Evolu}.
 *
 * ### Example
 *
 * ```ts
 * const useEvolu = createUseEvolu(evolu);
 * const { insert, update } = useEvolu();
 * ```
 */
export const createUseEvolu = <S extends EvoluSchema>(
  _evolu: Evolu<S>,
): (() => Evolu<S>) => useEvolu as () => Evolu<S>;
