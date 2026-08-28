import { FormulaDataTypes, JSEPNode } from 'nocodb-sdk';
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
 * Operand mentions per emitter site, mirroring `pg-ieee.ts`. These are counted
 * off the emitted string, not guessed: `ieeeModuloSql` tests the divisor, tests
 * the dividend for finiteness, then divides, so both operands land twice.
 *
 * A number here is the count of copies the emitter makes of the operand in that
 * slot. Slots are positional: `[left, right]` for a binary expression,
 * `arguments[i]` for a call.
 *
 * Keys with a handler under `fn-handler/` are absent on purpose — the handler
 * declares its own multiplicity, so a new variant updates this analysis for
 * free. Everything below is still a mirror, and each entry should move into a
 * handler when its lowering does.
 */
const IEEE_BINARY_MULTIPLICITY: Record<string, number[]> = {
  // ieeeModuloSql: (right) <> 0 · abs(left) · MOD((left), (right))
  '%': [2, 2],
};

function ieeeCallMultiplicity(
  name: string,
  args: { dataType?: FormulaDataTypes }[],
): number[] | undefined {
  switch (name) {
    // ieeePowerSql: (base) < 0 · pow(base, …) | (exp) <> floor(exp) · pow(…, exp)
    case 'POW':
    case 'POWER':
      return [2, 3];
    // ieeeModuloSql, reached through the MOD() spelling
    case 'MOD':
      return [2, 2];
    // ieeeSqrtSql: (expr) < 0 · sqrt(expr)
    case 'SQRT':
      return [2];
    // ieeeLogSql mentions its operand twice. Two-arg ieeeLogBaseSql proves both
    // operands in domain before the numeric cast: value 2 + 1, base 2 + 1 + 1.
    case 'LOG':
      return args.length > 1 ? [4, 3] : [2];
    // pg.MAX writes the whole argument list twice — NaN-stripped, then raw as
    // the COALESCE fallback — and only when every argument is numeric.
    case 'MAX':
    case 'GREATEST':
      return args.every((a) => a?.dataType === FormulaDataTypes.NUMERIC)
        ? args.map(() => 2)
        : undefined;
    default:
      return undefined;
  }
}

/** Copies this node makes of each operand, or undefined if it makes one each. */
export function operandMultiplicity(
  node: Record<string, unknown>,
  opts: DuplicationOptions = {},
): number[] | undefined {
  const key = fnKeyOf(node);
  if (!key) return undefined;

  // A registered lowering answers for itself — same handler, same conditions as
  // the build, so the two cannot drift. It needs no `ieee` gate: with the flag
  // off the resolver picks a variant that writes each operand once.
  const handler = getFnHandler(
    key,
    { pgIeee: opts.ieee, fnVariants: opts.fnVariants },
    node,
  );

  let mult: number[] | undefined;
  if (handler) {
    mult = handler.multiplicity(node);
  } else if (opts.ieee) {
    mult =
      node.type === JSEPNode.BINARY_EXP
        ? IEEE_BINARY_MULTIPLICITY[key]
        : ieeeCallMultiplicity(
            key,
            (node.arguments as { dataType?: FormulaDataTypes }[]) ?? [],
          );
  }
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
