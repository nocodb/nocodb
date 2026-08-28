import { UITypes } from 'nocodb-sdk';
import { DUPLICATION_DOMINANT_FACTOR, MIN_HOIST_RATIO } from './thresholds';
import { collectWeightedSites } from './duplication';
import type { DuplicatingSite } from './duplication';
import type { FnHandlerKey, FnVariant } from '~/db/formulav2/fn-handler';
import type {
  FormulaPlan,
  PlanColumnMeta,
  PlanMetaResolver,
  RefDescriptor,
} from './types';

const HOISTABLE_UIDTS = new Set<UITypes>([
  UITypes.Lookup,
  UITypes.LinkToAnotherRecord,
  UITypes.Links,
  UITypes.Rollup,
]);

/** Identifier sites in a parsed tree, in encounter order. Skips callee names. */
function collectSites(tree: unknown): string[] {
  return collectWeightedSites(tree).sites.map((site) => site.name);
}

export async function buildFormulaPlan({
  tree,
  resolve,
  minRatio = MIN_HOIST_RATIO,
  ieee = false,
  fnVariants,
}: {
  tree: unknown;
  resolve: PlanMetaResolver;
  minRatio?: number;
  /** the pg IEEE lowerings are in force — enables duplication detection */
  ieee?: boolean;
  /** the build pins a lowering — size it the way that variant emits */
  fnVariants?: Partial<Record<FnHandlerKey, FnVariant>>;
}): Promise<FormulaPlan> {
  const dupOpts = { ieee, fnVariants };
  const refs = new Map<string, RefDescriptor>();
  // memoised per-column subtree cost; keyed by column id
  const leafPathMemo = new Map<string, number>();

  // One site's worth of paths through a column's subtree. `path` guards cycles
  // (a revisit contributes 0 — the emitter's CircularRefContext throws before
  // any such formula could evaluate, so the plan just needs to terminate).
  const leafPaths = async (
    columnId: string,
    path: Set<string>,
  ): Promise<number> => {
    if (path.has(columnId)) return 0;
    if (leafPathMemo.has(columnId)) return leafPathMemo.get(columnId)!;
    const meta = await resolve(columnId);
    let result = 1;
    if (meta) {
      const nextPath = new Set(path).add(columnId);
      if (HOISTABLE_UIDTS.has(meta.uidt) && meta.targetColumnId) {
        result = await leafPaths(meta.targetColumnId, nextPath);
      } else if (meta.uidt === UITypes.Formula && meta.formulaTree) {
        result = 0;
        for (const site of collectSites(meta.formulaTree)) {
          result += await leafPaths(site, nextPath);
        }
      }
    }
    leafPathMemo.set(columnId, result);
    return result;
  };

  // `leafPaths` again, but counting the copies the emitter actually writes: a
  // site under a duplicating operand is emitted `weight` times. Kept separate
  // from `leafPaths` on purpose — the hoisting decision below is calibrated on
  // unweighted counts and this is detection only.
  const emittedPathMemo = new Map<string, number>();
  const emittedPaths = async (
    columnId: string,
    path: Set<string>,
  ): Promise<number> => {
    if (path.has(columnId)) return 0;
    if (emittedPathMemo.has(columnId)) return emittedPathMemo.get(columnId)!;
    const meta = await resolve(columnId);
    let result = 1;
    if (meta) {
      const nextPath = new Set(path).add(columnId);
      if (HOISTABLE_UIDTS.has(meta.uidt) && meta.targetColumnId) {
        result = await emittedPaths(meta.targetColumnId, nextPath);
      } else if (meta.uidt === UITypes.Formula && meta.formulaTree) {
        result = 0;
        for (const site of collectWeightedSites(meta.formulaTree, dupOpts)
          .sites) {
          result += site.weight * (await emittedPaths(site.name, nextPath));
        }
      }
    }
    emittedPathMemo.set(columnId, result);
    return result;
  };

  // The emitter is the source of truth for what hoists. `hoistFormulaLookup`
  // is reached only from the terminal `case UITypes.Formula`, and the hop walk
  // that gets there follows `uidt === Lookup` ONLY — a chain reaching a Rollup
  // or Links exits into those cases, which emit inline. So: walk Lookups, and
  // report the terminal only when it is a Formula the emitter can key on.
  const terminalOf = async (
    columnId: string,
  ): Promise<{ id: string; meta: PlanColumnMeta } | undefined> => {
    const first = await resolve(columnId);
    if (!first || first.uidt !== UITypes.Lookup) return undefined;
    const walked = new Set<string>();
    let current: string | undefined = columnId;
    while (current && !walked.has(current)) {
      walked.add(current);
      const meta = await resolve(current);
      if (!meta) return undefined;
      if (meta.uidt !== UITypes.Lookup) return { id: current, meta };
      current = meta.targetColumnId;
    }
    return undefined;
  };

  /** Block key the emitter would use for this reference, if it hoists it. */
  const blockKeyOf = async (columnId: string): Promise<string | undefined> => {
    const terminal = await terminalOf(columnId);
    if (!terminal || terminal.meta.uidt !== UITypes.Formula) return undefined;
    // no single-column PK → hoistFormulaLookup returns null and inlines
    if (terminal.meta.hasPrimaryKey === false) return undefined;
    return terminal.id;
  };

  // Subtree cost under the emitter's rules: a hoisted target formula's body is
  // written once (keyed by the FORMULA, so two lookups onto the same formula
  // share one block) and every later reference collapses to a scalar sub-query.
  // Everything else expands exactly as it does today.
  const hoistedCost = async (
    columnId: string,
    path: Set<string>,
    seen: Set<string>,
  ): Promise<number> => {
    if (path.has(columnId)) return 0;
    const meta = await resolve(columnId);
    if (!meta) return 1;
    const nextPath = new Set(path).add(columnId);

    const blockKey = await blockKeyOf(columnId);
    if (blockKey) {
      if (seen.has(blockKey)) return 0;
      seen.add(blockKey);
      return hoistedCost(blockKey, nextPath, seen);
    }

    if (HOISTABLE_UIDTS.has(meta.uidt)) {
      return meta.targetColumnId
        ? hoistedCost(meta.targetColumnId, nextPath, seen)
        : 1;
    }
    if (meta.uidt === UITypes.Formula && meta.formulaTree) {
      let sum = 0;
      for (const site of collectSites(meta.formulaTree)) {
        sum += await hoistedCost(site, nextPath, seen);
      }
      return sum;
    }
    return 1;
  };

  const chainDepth = async (columnId: string): Promise<number> => {
    let depth = 0;
    const visited = new Set<string>();
    let current: string | undefined = columnId;
    while (current && !visited.has(current)) {
      visited.add(current);
      const meta = await resolve(current);
      if (!meta || !HOISTABLE_UIDTS.has(meta.uidt)) break;
      depth++;
      current = meta.targetColumnId;
    }
    return depth;
  };

  const walk = collectWeightedSites(tree, dupOpts);
  const sites = walk.sites.map((site) => site.name);

  let inlineLeafPaths = 0;
  for (const site of sites) {
    inlineLeafPaths += await leafPaths(site, new Set());
  }

  let emittedLeafPaths = 0;
  for (const site of walk.sites) {
    emittedLeafPaths +=
      site.weight * (await emittedPaths(site.name, new Set()));
  }

  const seen = new Set<string>();
  let hoistedLeafPaths = 0;
  for (const site of sites) {
    hoistedLeafPaths += await hoistedCost(site, new Set(), seen);
  }

  for (const site of sites) {
    const existing = refs.get(site);
    if (existing) {
      existing.siteCount++;
      continue;
    }
    const meta = await resolve(site);
    const uidt = meta?.uidt as UITypes;
    let strategy: RefDescriptor['strategy'] = 'inline';
    let ineligibleReason: string | undefined;
    const blockKey = await blockKeyOf(site);
    if (blockKey) {
      strategy = 'cte-aggregate';
    } else if (meta && HOISTABLE_UIDTS.has(meta.uidt)) {
      const terminal = await terminalOf(site);
      ineligibleReason =
        terminal?.meta.uidt === UITypes.Formula
          ? 'target formula has no single-column primary key to key a block on'
          : `hoisting is lookup-onto-formula only; this chain ends at ${
              terminal?.meta.uidt ?? meta.uidt
            }`;
    } else if (
      meta?.uidt === UITypes.Formula ||
      meta?.uidt === UITypes.Button
    ) {
      ineligibleReason =
        'same-table formula/button builders are expressions, not sub-queries; excluded from hoisting';
    }
    refs.set(site, {
      columnId: site,
      uidt,
      siteCount: 1,
      isArray: !!meta?.isArray,
      hasSortLimitConfig: !!meta?.hasSortLimitConfig,
      depth: meta ? await chainDepth(site) : 0,
      leafPaths: await leafPaths(site, new Set()),
      strategy,
      ineligibleReason,
    });
  }

  // `seen` accumulated every block the emitter would write, at every depth —
  // not just top-level sites. Previously this listed reference columns, which
  // both missed nested blocks and named things the emitter never emits.
  const hoistable = [...seen].sort();

  const reductionRatio =
    hoistedLeafPaths > 0 ? inlineLeafPaths / hoistedLeafPaths : 1;

  const duplicationFactor =
    inlineLeafPaths > 0 ? emittedLeafPaths / inlineLeafPaths : 1;

  // Weight is what a site costs the statement, so ranking by it puts the
  // operand that got copied the most first — that is the one to fix.
  const duplicatingSites: DuplicatingSite[] = [...walk.duplicating].sort(
    (a, b) => b.weight * b.multiplicity - a.weight * a.multiplicity,
  );

  return {
    refs,
    inlineLeafPaths,
    hoistedLeafPaths,
    reductionRatio,
    hoistable,
    worthHoisting: reductionRatio >= minRatio && hoistable.length > 0,
    emittedLeafPaths,
    duplicationFactor,
    duplicatingSites,
    maxDuplicationChain: walk.maxChainDepth,
    // hoisting collapses at most `reductionRatio`; anything beyond that is the
    // duplication multiplier and no rebuild the gate can do will recover it
    duplicationDominant:
      duplicationFactor >= DUPLICATION_DOMINANT_FACTOR &&
      duplicationFactor > reductionRatio,
  };
}
