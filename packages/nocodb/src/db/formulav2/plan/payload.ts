import { JSEPNode } from 'nocodb-sdk';
import type { ParsedFormulaNode } from 'nocodb-sdk';
import type { FnHandlerKey, FnSitePath } from '~/db/formulav2/fn-handler';
import type { FormulaPayload, FormulaPlan, NodeOptimization } from './types';
import { fnSitePaths } from '~/db/formulav2/fn-handler';

/**
 * Fold a plan onto the tree it was built from, producing the payload the
 * rebuild runs on.
 *
 * The tree is copied, never annotated in place. `parsed_tree` is a persisted,
 * audited, command-registry-tracked column shared across every build in the
 * request, while a plan is request-scoped — it exists only because this build's
 * *measured* SQL cleared the gate threshold, on this dialect, with these flags.
 * The copy keeps those two lifetimes apart: the model's tree never learns about
 * a decision, and the rebuild's mutations (`prepareTree`, `assignFnName`) land
 * on the copy rather than aliasing back into the shared object.
 */
export function buildFormulaPayload({
  tree,
  plan,
}: {
  tree: unknown;
  plan: FormulaPlan;
}): FormulaPayload {
  const pathOf = fnSitePaths(tree);

  // path -> the duplicating site at it, and the entry that covers it
  const siteAt = new Map(
    plan.duplicatingSites.map((site) => [site.path, site]),
  );
  const entryAt = new Map<
    FnSitePath,
    Extract<FormulaPlan['optimizations'][number], { kind: 'fn-variant' }>
  >();
  for (const opt of plan.optimizations) {
    if (opt.kind !== 'fn-variant') continue;
    for (const path of opt.sites) entryAt.set(path, opt);
  }

  const annotate = (
    node: Record<string, unknown>,
    path: FnSitePath,
  ): NodeOptimization | undefined => {
    const site = siteAt.get(path);
    if (site) {
      const entry = entryAt.get(path);
      return {
        kind: 'fn-variant',
        path,
        status: entry?.status ?? 'unavailable',
        key: (entry?.key ?? site.kind) as FnHandlerKey,
        ...(entry?.variant ? { variant: entry.variant } : {}),
        weight: site.weight,
        multiplicity: site.multiplicity,
        chainDepth: site.chainDepth,
      };
    }

    if (node.type !== JSEPNode.IDENTIFIER || typeof node.name !== 'string') {
      return undefined;
    }
    const ref = plan.refs.get(node.name);
    // a plain scalar reference is not a decision — only say something when the
    // plan would hoist this one, or when it explicitly ruled it out
    if (!ref || (ref.strategy !== 'cte-aggregate' && !ref.ineligibleReason)) {
      return undefined;
    }
    return {
      kind: 'cte-hoist',
      path,
      status:
        plan.worthHoisting && ref.strategy === 'cte-aggregate'
          ? 'apply'
          : 'unavailable',
      columnId: ref.columnId,
      strategy: ref.strategy,
      ...(ref.ineligibleReason
        ? { ineligibleReason: ref.ineligibleReason }
        : {}),
    };
  };

  // memoised so a node reachable twice clones once — also what stops a cyclic
  // tree from recursing forever
  const clones = new Map<object, unknown>();
  const copy = (node: unknown): unknown => {
    if (!node || typeof node !== 'object') return node;
    const existing = clones.get(node);
    if (existing !== undefined) return existing;
    if (Array.isArray(node)) {
      const out: unknown[] = [];
      clones.set(node, out);
      for (const item of node) out.push(copy(item));
      return out;
    }
    const src = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    clones.set(node, out);
    for (const [key, value] of Object.entries(src)) out[key] = copy(value);
    const path = pathOf.get(src);
    const optimization = path === undefined ? undefined : annotate(src, path);
    if (optimization) out.optimization = optimization;
    return out;
  };

  return {
    parsedTree: copy(tree) as ParsedFormulaNode | undefined,
    plan: { ...plan, refs: Object.fromEntries(plan.refs) },
  };
}
