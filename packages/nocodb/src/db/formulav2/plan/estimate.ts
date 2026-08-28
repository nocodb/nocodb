import type { ClientType } from 'nocodb-sdk';
import type { FnNode } from '~/db/formulav2/fn-handler';
import {
  ESTIMATED_LEAF_BYTES,
  fnNodeKindOf,
  getFnNodeHandler,
} from '~/db/formulav2/fn-handler';

export interface EstimateOptions {
  clientType?: ClientType;
  /** the pg IEEE lowerings are in force — `isPgIeeeEnabled` */
  pgIeee?: boolean;
  /**
   * Bytes each column reference expands to, from `sizeTreeLeaves`. Omit and
   * every leaf costs `ESTIMATED_LEAF_BYTES`, which makes the result a floor
   * rather than a prediction.
   */
  leafBytes?: (name: string) => number | undefined;
}

/**
 * Bytes the emitter would write for this tree, composed from what each handler
 * says it writes. Builds no SQL: the tree walk is synchronous, and any column
 * resolution happened up front in `sizeTreeLeaves`.
 *
 * Every structural multiplier is exact, because the handler that duplicates an
 * operand is the same one that reports how many copies it makes — a division
 * chain's ~2ⁿ growth is predicted exactly, verified against emitted SQL up to
 * 46 copies. So accuracy is entirely a question of whether `leafBytes` was
 * supplied:
 *
 * - with it, measured 1.02-1.29x of actual and always high
 * - without it, 0.03-0.69x — a floor, never a bound to gate on
 *
 * Estimate the tree BEFORE the build, not after. A built tree has already been
 * through each handler's `prepareTree`, so the FLOAT wraps a division inserted
 * are nodes in it — and the division handler's estimate accounts for them too,
 * which double-counts.
 */
export function estimateFormulaBytes(
  tree: unknown,
  opts: EstimateOptions = {},
): number {
  const seen = new Set<object>();

  const visit = (node: unknown): number => {
    if (!node || typeof node !== 'object') return 0;
    // a shared or cyclic node is counted once; parsed trees are acyclic, this
    // only guards a hand-built one
    if (seen.has(node)) return 0;
    seen.add(node);

    const handler = getFnNodeHandler(fnNodeKindOf(node), opts.clientType);
    if (!handler) return ESTIMATED_LEAF_BYTES;

    return handler.estimate({
      pt: node as FnNode,
      estimate: visit,
      clientType: opts.clientType,
      pgIeee: opts.pgIeee,
      leafBytes: opts.leafBytes,
    });
  };

  return visit(tree);
}
