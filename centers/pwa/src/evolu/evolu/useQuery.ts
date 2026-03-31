import type { Query, QueryRows, Row } from "@evolu/common/local-first";
import type { Resource } from "solid-js";
import { useQuerySubscription } from "./useQuerySubscription.js";

/**
 * Load and subscribe to the query; same as {@link useQuerySubscription}.
 *
 * Matches the `@evolu/react` split: `useQuery` is the primary entry, implemented
 * here by delegating to the shared subscription + resource implementation.
 */
export const useQuery = <R extends Row>(
  query: Query<R>,
  options: Partial<{
    readonly once: boolean;
    readonly promise: Promise<QueryRows<R>>;
  }> = {},
): Resource<QueryRows<R>> => useQuerySubscription(query, options);
