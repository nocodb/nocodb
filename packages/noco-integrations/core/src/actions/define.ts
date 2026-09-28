import { ActionsIntegration } from './types';
import type { ActionsIntegrationConstructor, Capability } from './types';

/** The `{capabilities, call}` pair a capability factory hands back — e.g.
 *  `httpCapabilities(endpoints)`. Kept structural so a provider with a bespoke
 *  client can supply its own object without importing a base class. */
export interface ActionsDelegate<TAuth = unknown> {
  capabilities(): Capability[];
  call(
    auth: TAuth,
    capabilityId: string,
    authored: Record<string, unknown>,
    input: Record<string, unknown>,
  ): Promise<unknown>;
}

/**
 * Wraps a delegate in the `ActionsIntegration` subclass `defineActionsEntry`
 * expects. Every ported provider would otherwise re-declare the same two
 * forwarding methods — four re-typed parameters each — so the delegation lives
 * here once and a package spends one line on it.
 *
 * `capabilities()` forwards per call rather than snapshotting: the delegate owns
 * whether its manifest is a fresh copy, and a hoisted array would let one
 * consumer's mutation desynchronise every other reader from what is callable.
 */
export function defineActionsIntegration<TAuth>(
  requiresAuth: string,
  delegate: ActionsDelegate<TAuth>,
): ActionsIntegrationConstructor {
  return class extends ActionsIntegration<TAuth> {
    readonly requiresAuth = requiresAuth;

    capabilities(): Capability[] {
      return delegate.capabilities();
    }

    call(
      auth: TAuth,
      capabilityId: string,
      authored: Record<string, unknown>,
      input: Record<string, unknown>,
    ): Promise<unknown> {
      return delegate.call(auth, capabilityId, authored, input);
    }
  };
}
