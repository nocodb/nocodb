import { z } from 'zod';
import type { NcContext, NcRequest, PlanFeatureTypes } from 'nocodb-sdk';
import type { McpToolUser } from '~/mcp/tools/tool-helpers';

/** The ACL scope an operation is declared under, as in `@Acl(op, { scope })`. */
export type McpAclScope = 'base' | 'workspace' | 'org' | 'cloudOrg';

/** What a tool declares about the REST operation it fronts. */
export interface McpToolAcl {
  op: string;
  scope: McpAclScope;
  /**
   * Plan feature the tool is sold under. A base session checked it once at
   * registration; an account session can only check it after the call has
   * landed in a workspace.
   */
  feature?: PlanFeatureTypes;
  /**
   * The tool destroys something its operation's name does not admit to —
   * `removeFieldOptions` calls `columnUpdate`. Puts the call behind the delete
   * tier, which is where the tool is listed.
   */
  deletes?: boolean;
}

/** What a tool call names as its target, and what it costs. */
export interface McpScopeTarget {
  baseId?: string;
  workspaceId?: string;
  /**
   * API calls this one tool call is worth — what the same work would cost over
   * the public v3 REST API. Omitted means 1: one tool call, one REST call.
   * Fan-out tools compute it from the live REST cap; see `tool-units.ts`.
   */
  units?: number;
}

/** The context, principal and request one tool call runs as. */
export interface McpToolTarget {
  context: NcContext;
  user: McpToolUser;
  req: NcRequest;
}

/**
 * How a tool gets the context it runs in.
 *
 * A base session resolved everything at connect — one base, roles checked once
 * at registration — so its scope hands back the captured target unchanged. An
 * account session has no ambient base: the target arrives in the tool's
 * arguments and is authorised per call. Every tool is written once against
 * this interface and serves both surfaces.
 */
export interface McpToolScope {
  /**
   * True when tools must take their target id as an argument, because no base
   * or workspace is implied by the session.
   */
  readonly addressesBase: boolean;
  resolve(acl: McpToolAcl, target?: McpScopeTarget): Promise<McpToolTarget>;
  assertFeature(
    target: McpToolTarget,
    feature: PlanFeatureTypes,
  ): Promise<void>;
}

/** `{ baseId }` on the account surface, nothing on a base session. */
export function baseIdInput(scope: McpToolScope) {
  return scope.addressesBase
    ? {
        baseId: z.string().describe('Base ID — from listBases or createBase'),
      }
    : {};
}

/** `{ workspaceId }` on the account surface, nothing on a base session. */
export function workspaceIdInput(scope: McpToolScope) {
  return scope.addressesBase
    ? {
        workspaceId: z.string().describe('Workspace ID — from listWorkspaces'),
      }
    : {};
}

export class McpFixedBaseScope implements McpToolScope {
  readonly addressesBase = false;

  constructor(protected readonly target: McpToolTarget) {}

  async resolve(_acl?: McpToolAcl, scopeTarget: McpScopeTarget = {}) {
    await this.meter(scopeTarget.units ?? 1);
    return this.target;
  }

  /**
   * No-op in CE, which has no plans and no usage counters. The EE subclass in
   * `src/ee/mcp/tools/tool-scope.ts` charges the workspace.
   */
  protected async meter(_units: number): Promise<void> {}

  async assertFeature() {
    // Already gated at registration on this surface.
  }
}
