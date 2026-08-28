import { ClientType } from 'nocodb-sdk';
import { CLIENT_DEFAULT } from './fn-handler.interface';
import { BinaryExpressionGeneralHandler } from './handlers/binary-expression/binary-expression.general.handler';
import { CallExpressionGeneralHandler } from './handlers/call-expression/call-expression.general.handler';
import { DivisionGeneralHandler } from './handlers/division/division.general.handler';
import { DivisionPgHandler } from './handlers/division/division.pg.handler';
import { IdentifierGeneralHandler } from './handlers/identifier/identifier.general.handler';
import { LogPgHandler } from './handlers/log/log.pg.handler';
import { GreatestPgHandler, MaxPgHandler } from './handlers/max/max.pg.handler';
import { ModPgHandler } from './handlers/mod/mod.pg.handler';
import { ModuloGeneralHandler } from './handlers/modulo/modulo.general.handler';
import { ModuloPgHandler } from './handlers/modulo/modulo.pg.handler';
import {
  PowerPgHandler,
  PowPgHandler,
} from './handlers/power/power.pg.handler';
import { RoundPgHandler } from './handlers/round/round.pg.handler';
import { SqrtPgHandler } from './handlers/sqrt/sqrt.pg.handler';
import { LiteralGeneralHandler } from './handlers/literal/literal.general.handler';
import { UnaryExpressionGeneralHandler } from './handlers/unary-expression/unary-expression.general.handler';
import type {
  FnClient,
  FnConditions,
  FnHandlerInterface,
  FnHandlerKey,
  FnNodeHandlerInterface,
  FnNodeKind,
  FnVariant,
  ResolvedFnHandler,
} from './fn-handler.interface';
import type { FnNode } from './fn-node';

/**
 * One entry per lowered function/operator, then per dialect, then per variant.
 * Same dialect axis as the field-handler registry — `CLIENT_DEFAULT` is the
 * bucket every client falls back to — with a third level the field handlers do
 * not need: several lowerings of one operator can coexist on one dialect, and
 * the query plan picks between them per site.
 *
 * Add a lowering by adding its key here — nothing else in the emitter or the
 * query plan needs to know about it. Unregistered keys resolve to undefined and
 * keep whatever inline handling they have today.
 */
const FN_REGISTRY: Partial<
  Record<FnHandlerKey, Partial<Record<FnClient, new () => FnHandlerInterface>>>
> = {
  '/': {
    [CLIENT_DEFAULT]: DivisionGeneralHandler,
    // pg is the only dialect that can produce ±Infinity/NaN by hand. That is a
    // variant this class emits, not a separate registration.
    [ClientType.PG]: DivisionPgHandler,
  },
  '%': {
    [CLIENT_DEFAULT]: ModuloGeneralHandler,
    [ClientType.PG]: ModuloPgHandler,
  },
  // Function-keyed lowerings. pg only, deliberately: these guard IEEE
  // semantics pg alone can produce, and every other dialect keeps resolving to
  // no handler and going through `mapFunctionName` unchanged.
  MOD: { [ClientType.PG]: ModPgHandler },
  POWER: { [ClientType.PG]: PowerPgHandler },
  POW: { [ClientType.PG]: PowPgHandler },
  LOG: { [ClientType.PG]: LogPgHandler },
  SQRT: { [ClientType.PG]: SqrtPgHandler },
  MAX: { [ClientType.PG]: MaxPgHandler },
  GREATEST: { [ClientType.PG]: GreatestPgHandler },
  ROUND: { [ClientType.PG]: RoundPgHandler },
};

/**
 * One entry per parsed-tree node kind, then per dialect — the outer dispatch,
 * above the per-operator lowerings. The two nest rather than compete: a
 * `bin_exp` handler resolves `/` from `FN_REGISTRY` while it runs.
 *
 * Every kind is `CLIENT_DEFAULT` today; the branching each one does on
 * `knex.clientType()` internally is what a dialect entry would later take over.
 */
const FN_NODE_REGISTRY: Partial<
  Record<
    FnNodeKind,
    Partial<Record<FnClient, new () => FnNodeHandlerInterface>>
  >
> = {
  bin_exp: { [CLIENT_DEFAULT]: BinaryExpressionGeneralHandler },
  call_exp: { [CLIENT_DEFAULT]: CallExpressionGeneralHandler },
  literal: { [CLIENT_DEFAULT]: LiteralGeneralHandler },
  identifier: { [CLIENT_DEFAULT]: IdentifierGeneralHandler },
  unary_exp: { [CLIENT_DEFAULT]: UnaryExpressionGeneralHandler },
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
 * The variants registered for this key on this dialect, falling back to the
 * catch-all bucket.
 *
 * `pgIeee` stands in for the dialect when no `clientType` was given, because
 * `isPgIeeeEnabled` is `flag && isPgClient` — the flag cannot be true anywhere
 * but pg. That keeps a caller that only knows about the flag (the query plan,
 * which is built without a connection) resolving the same handler the emitter
 * will use, instead of silently dropping to `general` and under-reporting
 * duplication.
 */
function clientOf(conditions: FnConditions): FnClient {
  return (
    conditions.clientType ??
    (conditions.pgIeee ? ClientType.PG : undefined) ??
    CLIENT_DEFAULT
  );
}

function classOf(key: FnHandlerKey, conditions: FnConditions) {
  const byClient = FN_REGISTRY[key];
  if (!byClient) return undefined;
  return byClient[clientOf(conditions)] ?? byClient[CLIENT_DEFAULT];
}

/**
 * Which lowering this site asks for: the node's own annotation first, since it
 * names one occurrence where `fnVariants` names all of them, then the IEEE flag,
 * else `general`.
 *
 * Nothing checks that the dialect offers it. A handler that does not implement a
 * variant ignores the argument and emits its general form — which is exactly
 * what `DivisionGeneralHandler` does — so an inapplicable request degrades on
 * its own instead of needing a guard here. The corollary: this is the variant
 * *requested*, not a promise that it was emitted.
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
  const pinned = sitePinOf(node) ?? conditions.fnVariants?.[key];
  if (pinned) return pinned;
  return conditions.pgIeee ? 'pg-ieee' : 'general';
}

/**
 * The handler for this key plus the variant it should emit, or undefined when
 * nothing is registered. Both come back together because the class no longer
 * encodes the variant — every method whose output depends on it takes it.
 */
export function getFnHandler(
  key: FnHandlerKey | undefined,
  conditions: FnConditions = {},
  node?: FnNode,
): ResolvedFnHandler | undefined {
  if (!key) return undefined;
  const Handler = classOf(key, conditions);
  if (!Handler) return undefined;
  return {
    handler: new Handler(),
    variant: resolveFnVariant(key, conditions, node),
  };
}

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

/** The handler for this node kind on this dialect, or the catch-all. */
export function getFnNodeHandler(
  kind: FnNodeKind | undefined,
  clientType?: ClientType,
): FnNodeHandlerInterface | undefined {
  if (!kind) return undefined;
  const byClient = FN_NODE_REGISTRY[kind];
  const Handler =
    (clientType && byClient?.[clientType]) ?? byClient?.[CLIENT_DEFAULT];
  return Handler ? new Handler() : undefined;
}
