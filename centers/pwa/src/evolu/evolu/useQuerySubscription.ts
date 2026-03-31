import { constVoid } from "@evolu/common";
import type { Query, QueryRows, Row } from "@evolu/common/local-first";
import type { Resource } from "solid-js";
import { createResource, onCleanup } from "solid-js";
import { useEvolu } from "./useEvolu.js";

/**
 * Load and subscribe to a {@link Query}: initial data uses {@link createResource}
 * (Solid Suspense, like React `use(loadQuery)`), then {@link Evolu#subscribeQuery}
 * keeps the resource updated (like React `useQuerySubscription` + `useSyncExternalStore`).
 *
 * Unlike `@evolu/react`'s `useQuerySubscription` (subscribe-only), this hook includes
 * the load half so one call matches “query rows in the UI” end-to-end.
 *
 * Use under `<Suspense fallback={...}>` for first-load UI.
 */
export const useQuerySubscription = <R extends Row>(
  query: Query<R>,
  options: Partial<{
    readonly once: boolean;
    /** When set (e.g. from {@link useQueries}), uses this promise instead of `loadQuery`. */
    readonly promise: Promise<QueryRows<R>>;
  }> = {},
): Resource<QueryRows<R>> => {
  const evolu = useEvolu();
  const { once, promise } = options;

  const load = (): Promise<QueryRows<R>> => promise ?? evolu.loadQuery(query);

  if (once) {
    const [rows] = createResource(load);
    onCleanup(evolu.subscribeQuery(query)(constVoid));
    return rows;
  }

  const [rows, { mutate }] = createResource(load);
  onCleanup(
    evolu.subscribeQuery(query)(() => {
      mutate(evolu.getQueryRows(query));
    }),
  );

  return rows;
};
