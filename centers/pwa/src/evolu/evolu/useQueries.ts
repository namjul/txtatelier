import type {
  Queries,
  Query,
  QueriesToQueryRowsPromises,
  QueryRows,
  Row,
} from "@evolu/common/local-first";
import type { Resource } from "solid-js";
import { useEvolu } from "./useEvolu.js";
import { useQuerySubscription } from "./useQuerySubscription.js";

/**
 * The same as {@link useQuery}, but for many queries.
 *
 * The number of queries must remain stable across renders.
 *
 * Returns a tuple of resources (one per query). Use under {@link Suspense} like
 * {@link useQuery}.
 */
export const useQueries = <
  R extends Row,
  Q extends Queries<R>,
  OQ extends Queries<R>,
>(
  queries: [...Q],
  options: Partial<{
    readonly once: [...OQ];
    readonly promises: [
      ...QueriesToQueryRowsPromises<Q>,
      ...QueriesToQueryRowsPromises<OQ>,
    ];
  }> = {},
): [
  ...{
    [K in keyof Q]: Q[K] extends Query<infer RowR>
      ? Resource<QueryRows<RowR>>
      : never;
  },
  ...{
    [K in keyof OQ]: OQ[K] extends Query<infer RowR>
      ? Resource<QueryRows<RowR>>
      : never;
  },
] => {
  const evolu = useEvolu();
  const once = options.once;
  const allQueries = once ? [...queries, ...once] : queries;

  if (options.promises == null) {
    void evolu.loadQueries(allQueries);
  }

  return allQueries.map((query, i) => {
    const promise = options.promises?.[i];
    return useQuerySubscription(query, {
      once: once != null && i > queries.length - 1,
      ...(promise != null ? { promise } : {}),
    });
  }) as never;
};
