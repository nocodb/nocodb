import { collectWeightedSites } from './duplication';
import { estimateFormulaBytes } from './estimate';
import { sizeTreeLeaves } from './leaf-size';
import type { ClientType } from 'nocodb-sdk';
import type { PlanMetaResolver } from './types';
import type { FnHandlerKey, FnVariant } from '~/db/formulav2/fn-handler';

export interface TriageOptions {
  clientType?: ClientType;
  /** the pg IEEE lowerings are in force — `isPgIeeeEnabled` */
  pgIeee?: boolean;
  /** the build pins a lowering — size it the way that variant emits */
  fnVariants?: Partial<Record<FnHandlerKey, FnVariant>>;
  /**
   * Column metadata for sizing the leaves. Omit and `estimatedBytes` is only a
   * floor — the structural terms are still exact, but every reference counts as
   * `ESTIMATED_LEAF_BYTES`.
   */
  resolve?: PlanMetaResolver;
  /** exact size for a plain column of the table being selected from */
  plainBytes?: (columnId: string) => number | undefined;
}

export interface FormulaTriage {
  /** what the handlers say this tree emits, before anything is built */
  estimatedBytes: number;
  /** `estimatedBytes` is a prediction rather than a floor — leaves were sized */
  estimateIsSized: boolean;
  /** Identifier occurrences in the tree */
  referenceSites: number;
  /** distinct columns those occurrences point at */
  distinctReferences: number;
  /** operator/function sites that write an operand more than once */
  duplicatingSites: number;
  /**
   * False only when neither optimization could possibly apply, so the full plan
   * cannot change the outcome and need not be built.
   */
  worthPlanning: boolean;
  /** why, for the log — the gate's decision should be readable */
  reason: string;
}

/**
 * The cheap half of planning, run BEFORE the build so the gate can pick a
 * strategy instead of discovering the size afterwards.
 *
 * Two parts, in cost order:
 *
 * 1. A synchronous tree walk deciding whether the full plan could change
 *    anything at all. It must never rule one out that `buildFormulaPlan` would
 *    have acted on — a false "not worth it" silently disables hoisting — so the
 *    bar is deliberately low:
 *
 *    - Hoisting dedupes reference expansions, so it needs at least one
 *      Identifier site. NOT two: `collectWeightedSites` sees only the top-level
 *      tree, and a single reference onto a formula that internally repeats
 *      another reference still hoists by alternation.
 *    - Relowering needs a site that duplicates an operand.
 *
 *    That filters the inert case (literals and calls with no column reference)
 *    rather than predicting anything.
 *
 * 2. Sizing the leaves, which is the only part that touches column metadata.
 *    Skipped entirely when step 1 says there is nothing to plan, and
 *    `plainBytes` answers for the root model's own columns without a resolve —
 *    so a formula over ordinary fields costs no metadata reads.
 */
export async function triageFormula(
  tree: unknown,
  opts: TriageOptions = {},
): Promise<FormulaTriage> {
  const walk = collectWeightedSites(tree, {
    ieee: opts.pgIeee,
    fnVariants: opts.fnVariants,
  });
  const referenceSites = walk.sites.length;
  const distinctReferences = new Set(walk.sites.map((site) => site.name)).size;
  const duplicatingSites = walk.duplicating.length;

  const canHoist = referenceSites >= 1;
  const canRelower = duplicatingSites > 0;
  const worthPlanning = canHoist || canRelower;

  let leafBytes: Map<string, number> | undefined;
  if (worthPlanning && opts.resolve) {
    // a metadata failure must not fail the build — fall back to the floor
    leafBytes = await sizeTreeLeaves(tree, {
      resolve: opts.resolve,
      clientType: opts.clientType,
      pgIeee: opts.pgIeee,
      fnVariants: opts.fnVariants,
      plainBytes: opts.plainBytes,
    }).catch(() => undefined);
  }

  return {
    estimatedBytes: estimateFormulaBytes(tree, {
      clientType: opts.clientType,
      pgIeee: opts.pgIeee,
      leafBytes: leafBytes && ((name) => leafBytes!.get(name)),
    }),
    estimateIsSized: !!leafBytes,
    referenceSites,
    distinctReferences,
    duplicatingSites,
    worthPlanning,
    reason: worthPlanning
      ? `${referenceSites} reference site(s) over ${distinctReferences} column(s), ${duplicatingSites} duplicating site(s)`
      : 'nothing to dedupe or relower — no reference site, no duplicating site',
  };
}
