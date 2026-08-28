import { JSEPNode } from 'nocodb-sdk';
import type {
  FnHandlerKey,
  FnSitePath,
  FnVariant,
} from '~/db/formulav2/fn-handler';
import {
  FN_NON_OPERAND_KEYS,
  fnKeyOf,
  fnSitePaths,
  fnSlots,
  getFnHandler,
} from '~/db/formulav2/fn-handler';

/**
 * Operand duplication: the second bloat source, orthogonal to reference
 * fan-out. The pg IEEE lowerings in `pg-ieee.ts` guard a value before using
 * it, so they write some operands into the SQL text more than once. `/` is
 * left-associative, so in `a/b/c/d` each division's left operand is the whole
 * inner CASE — the expression grows 2ⁿ in chain length while the reference
 * count stays flat. `leafPaths` cannot see that: it counts sites in the tree,
 * and the tree is the same size either way.
 */
export interface DuplicationOptions {
  /**
   * The pg IEEE lowerings are in force (`isPgIeeeEnabled`). Off means every
   * site writes each operand exactly once and the whole analysis is a no-op —
   * weights stay 1 and no site is reported.
   */
  ieee?: boolean;
  /**
   * The build pins a lowering key-wide — resolve the same handler it will emit.
   * Per-node pins need no option: `getFnHandler` reads them off the node.
   */
  fnVariants?: Partial<Record<FnHandlerKey, FnVariant>>;
}

export interface WeightedSite {
  /** column id at an Identifier site */
  name: string;
  /** copies of this site's SQL the emitted statement carries */
  weight: number;
}

export interface DuplicatingSite {
  /** operator spelling (`/`) or the uppercased callee name (`POWER`) */
  kind: string;
  /**
   * Where in the parsed tree this site is — what an optimization names to pin a
   * variant onto this occurrence and no other. See `fnSitePaths`.
   */
  path: FnSitePath;
  /** copies of this site's own SQL the statement carries */
  weight: number;
  /** largest number of copies it makes of any one of its operands */
  multiplicity: number;
  /** duplicating sites enclosing it, itself included — n of them give ~2ⁿ */
  chainDepth: number;
}

export interface DuplicationWalk {
  /** Identifier sites in encounter order, each with its text weight */
  sites: WeightedSite[];
  /** every duplicating site the walk passed through */
  duplicating: DuplicatingSite[];
  /** longest nested run of duplicating sites */
  maxChainDepth: number;
}

/**
 * Copies this node makes of each operand, or undefined if it makes one each.
 *
 * Every duplicating lowering is a registered handler, so each answers for
 * itself — resolved with the same key and conditions the emitter will use, so
 * the count and the SQL cannot drift apart. This used to carry a hand-written
 * mirror of `pg-ieee.ts` alongside; the mirror is what let `ROUND` go
 * unreported (it writes its value operand three times and had no entry).
 *
 * No `ieee` gate is needed: with the flag off the resolver picks a variant
 * that writes each operand once.
 */
export function operandMultiplicity(
  node: Record<string, unknown>,
  opts: DuplicationOptions = {},
): number[] | undefined {
  const key = fnKeyOf(node);
  if (!key) return undefined;

  const resolved = getFnHandler(
    key,
    { pgIeee: opts.ieee, fnVariants: opts.fnVariants },
    node,
  );
  const mult = resolved?.handler.multiplicity(node, resolved.variant);

  // writing every operand once is not a duplicating site
  return mult?.some((copies) => copies > 1) ? mult : undefined;
}

/**
 * Identifier sites in encounter order, each weighted by how many times the
 * emitter writes it. Callee names are skipped, as they are not references.
 * With `ieee` off every weight is 1, which is the pre-existing site walk.
 */
export function collectWeightedSites(
  tree: unknown,
  opts: DuplicationOptions = {},
): DuplicationWalk {
  const sites: WeightedSite[] = [];
  const duplicating: DuplicatingSite[] = [];
  let maxChainDepth = 0;
  // labelled by the shared walker, not by this one — the emitter resolves these
  // same paths back to nodes, so the two must name a position identically
  const pathOf = fnSitePaths(tree);

  const visit = (node: unknown, weight: number, chain: number) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, weight, chain);
      return;
    }
    const n = node as Record<string, unknown>;
    if (n.type === JSEPNode.IDENTIFIER && typeof n.name === 'string') {
      sites.push({ name: n.name, weight });
      return;
    }

    const mult = operandMultiplicity(n, opts);
    if (mult) {
      const depth = chain + 1;
      maxChainDepth = Math.max(maxChainDepth, depth);
      duplicating.push({
        kind: fnKeyOf(n) ?? '',
        path: pathOf.get(n) ?? '',
        weight,
        multiplicity: Math.max(...mult),
        chainDepth: depth,
      });
      // only the operand slots — a duplicating call must not re-descend into
      // its callee, and the slot walk is what carries the weights
      fnSlots(n).forEach((slot, i) =>
        visit(slot, weight * (mult[i] ?? 1), depth),
      );
      return;
    }

    for (const key of Object.keys(n)) {
      if (FN_NON_OPERAND_KEYS.has(key)) continue;
      const child = n[key];
      if (child && typeof child === 'object') visit(child, weight, chain);
    }
  };

  visit(tree, 1, 0);
  return { sites, duplicating, maxChainDepth };
}
