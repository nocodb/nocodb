import { BinaryExpressionHandler } from './handlers/binary-expression.handler';
import { CallExpressionHandler } from './handlers/call-expression.handler';
import {
  IdentifierHandler,
  LiteralHandler,
  UnaryExpressionHandler,
} from './handlers/leaf.handlers';
import { DivisionGeneralHandler } from './handlers/division.general.handler';
import { DivisionPgIeeeHandler } from './handlers/division.pg-ieee.handler';
import type {
  FnConditions,
  FnHandlerInterface,
  FnHandlerKey,
  FnNodeHandlerInterface,
  FnNodeKind,
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

/**
 * One entry per parsed-tree node kind — the outer dispatch, above the
 * per-operator lowerings in `FN_REGISTRY`. The two nest rather than compete: a
 * `bin_exp` handler resolves `/` from `FN_REGISTRY` while it runs.
 *
 * No variant axis here: a node handler holds whatever dialect branching it
 * needs internally, so there is nothing for a caller to pin.
 */
const FN_NODE_REGISTRY: Partial<
  Record<FnNodeKind, new () => FnNodeHandlerInterface>
> = {
  bin_exp: BinaryExpressionHandler,
  call_exp: CallExpressionHandler,
  literal: LiteralHandler,
  identifier: IdentifierHandler,
  unary_exp: UnaryExpressionHandler,
};

/** The node kind this parsed-tree node dispatches under, if any. */
export function fnNodeKindOf(node: unknown): FnNodeKind | undefined {
  const type = (node as { type?: string })?.type;
  switch (type) {
    case 'BinaryExpression':
      return 'bin_exp';
    case 'CallExpression':
      return 'call_exp';
    case 'Literal':
      return 'literal';
    case 'Identifier':
      return 'identifier';
    case 'UnaryExpression':
      return 'unary_exp';
    default:
      return undefined;
  }
}

/** The handler for this node kind, or undefined while it is still inline. */
export function getFnNodeHandler(
  kind: FnNodeKind | undefined,
): FnNodeHandlerInterface | undefined {
  if (!kind) return undefined;
  const Handler = FN_NODE_REGISTRY[kind];
  return Handler ? new Handler() : undefined;
}
