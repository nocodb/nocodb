import { DivisionGeneralHandler } from './handlers/division.general.handler';
import { DivisionPgIeeeHandler } from './handlers/division.pg-ieee.handler';
import type {
  FnConditions,
  FnHandlerInterface,
  FnHandlerKey,
  FnVariant,
} from './fn-handler.interface';

export * from './fn-handler.interface';
export * from './fn-node';
export { DivisionGeneralHandler } from './handlers/division.general.handler';
export { DivisionPgIeeeHandler } from './handlers/division.pg-ieee.handler';

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
 * The one place generation is conditioned. A pin wins if that variant exists
 * for the key; otherwise pg+IEEE takes the `pg-ieee` variant when there is one,
 * and everything else falls back to `general`.
 */
export function resolveFnVariant(
  key: FnHandlerKey,
  conditions: FnConditions = {},
): FnVariant {
  const variants = FN_REGISTRY[key];
  const pinned = conditions.fnVariants?.[key];
  if (pinned && variants?.[pinned]) return pinned;
  if (conditions.pgIeee && variants?.['pg-ieee']) return 'pg-ieee';
  return 'general';
}

/** The handler for this key, or undefined when nothing is registered for it. */
export function getFnHandler(
  key: FnHandlerKey | undefined,
  conditions: FnConditions = {},
): FnHandlerInterface | undefined {
  if (!key) return undefined;
  const variants = FN_REGISTRY[key];
  if (!variants) return undefined;
  const Handler =
    variants[resolveFnVariant(key, conditions)] ?? variants.general;
  return Handler ? new Handler() : undefined;
}
