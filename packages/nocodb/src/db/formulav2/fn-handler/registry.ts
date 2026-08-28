import { DivisionGeneralHandler } from './handlers/division.general.handler';
import { DivisionPgIeeeHandler } from './handlers/division.pg-ieee.handler';
import type {
  FnConditions,
  FnHandlerInterface,
  FnHandlerKey,
  FnVariant,
} from './fn-handler.interface';
import type { FnNode } from './fn-node';

/**
 * One entry per lowered function/operator, one class per variant of it. Same
 * shape as the field-handler registry: key first, then the variant, with
 * `general` as the fallback every key must provide.
 *
 * Add a lowering by adding its key here — nothing else in the emitter or the
 * query plan needs to know about it. Unregistered keys resolve to undefined and
 * keep whatever inline handling they have today.
 */
const FN_REGISTRY: Partial<
  Record<FnHandlerKey, Partial<Record<FnVariant, new () => FnHandlerInterface>>>
> = {
  '/': {
    general: DivisionGeneralHandler,
    'pg-ieee': DivisionPgIeeeHandler,
  },
};

/**
 * This node's own pinned variant, if the query plan annotated it. Read straight
 * off the node so a decision and the expression it applies to travel together —
 * there is no side table that could be keyed against a different tree.
 */
function sitePinOf(node: FnNode | undefined): FnVariant | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const optimization = (node as { optimization?: unknown }).optimization as
    | { kind?: string; status?: string; variant?: FnVariant }
    | undefined;
  return optimization?.kind === 'fn-variant' &&
    optimization.status === 'apply' &&
    optimization.variant
    ? optimization.variant
    : undefined;
}

/**
 * The one place generation is conditioned. A pin wins if that variant exists
 * for the key — the node's own annotation first, since it names one occurrence
 * and `fnVariants` names all of them; otherwise pg+IEEE takes the `pg-ieee`
 * variant when there is one, and everything else falls back to `general`.
 *
 * `node` is optional only so a caller with nothing but a key can still ask what
 * the key-wide answer is. Anything lowering an actual expression has the node
 * and should pass it, or its annotation is silently ignored.
 */
export function resolveFnVariant(
  key: FnHandlerKey,
  conditions: FnConditions = {},
  node?: FnNode,
): FnVariant {
  const variants = FN_REGISTRY[key];
  const pinned = sitePinOf(node) ?? conditions.fnVariants?.[key];
  if (pinned && variants?.[pinned]) return pinned;
  if (conditions.pgIeee && variants?.['pg-ieee']) return 'pg-ieee';
  return 'general';
}

/** The handler for this key, or undefined when nothing is registered for it. */
export function getFnHandler(
  key: FnHandlerKey | undefined,
  conditions: FnConditions = {},
  node?: FnNode,
): FnHandlerInterface | undefined {
  if (!key) return undefined;
  const variants = FN_REGISTRY[key];
  if (!variants) return undefined;
  const Handler =
    variants[resolveFnVariant(key, conditions, node)] ?? variants.general;
  return Handler ? new Handler() : undefined;
}
