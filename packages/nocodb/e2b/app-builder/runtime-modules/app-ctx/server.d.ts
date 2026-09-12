// Public type surface for the `@nocodb/app-ctx/server` authoring module. The
// implementation is compiled from server.ts at image-build into server.js; this
// declaration is what app action code type-checks against. Keep it in lockstep
// with the exports in server.ts.
//
// The types below are copied VERBATIM from `contract-app-actions.ts` §2–§3 (the
// normative contract), plus the two §1 identity aliases they reference. Backend
// dispatch, the in-sandbox harness and AI-written app code all type against
// these exact names — they must not drift.

import type { z } from 'zod/v4';

/* ===========================================================================
 * 1. IDENTITY
 * ========================================================================= */

/**
 * Dotted, lowercase. First segment is a namespace the APP chooses — it is NOT
 * required to name a table, and often should not (`billing.run_month_end` spans
 * several). Namespacing exists for legibility and glob grants (`billing.*`).
 *
 * Immutable within a major app version.
 */
export type ActionId = string; // ^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$

/**
 * A capability is just an ActionId or a glob over one. There is no separate
 * capability registry — that is the point. One string is the capability name,
 * the REST path segment, the MCP tool name and the SDK method path.
 */
export type Capability = string; // 'invoice.void' | 'billing.*'

/* ===========================================================================
 * 2. THE ACTION CONTEXT (what `run` receives)
 * ========================================================================= */

export interface ActionUser {
  id: string;
  email: string;
  name?: string;
}

/** Bound by `handle`, never by id — one published app runs across many installs. */
export interface ActionTeam {
  handle: string;
  title: string;
}

export interface ActionContext {
  readonly user: ActionUser;
  readonly teams: readonly ActionTeam[];

  /**
   * RENDERING AID ONLY — mirrors what the server will decide. Never the
   * enforcement point: dispatch checks the same capability before `run()` and
   * returns 403 regardless of what this returned.
   */
  can(capability: Capability): boolean;

  /**
   * Call another action. Refuses at RUNTIME any id not in this action's declared
   * `uses` — fail-closed without needing sound static analysis of generated code.
   * Dynamic member access (`ctx.actions[expr]`) is banned by publish lint so
   * capability enumeration stays sound.
   */
  readonly actions: ActionInvoker;

  /** NcError-backed constructors; the only supported way to fail with a status. */
  readonly error: {
    badRequest(msg: string, details?: unknown): Error;
    notFound(msg: string): Error;
    forbidden(msg: string): Error;
    conflict(msg: string): Error;
  };

  /** Correlates every SDK call and audit row for this invocation. */
  readonly requestId: string;

  /** Structured only. No stdout scraping. */
  readonly log: (msg: string, fields?: Record<string, unknown>) => void;
}

/**
 * Typed at build time against the app's own registry (see §5), so
 * `ctx.actions['appointment.read']({ id })` is fully inferred.
 */
export type ActionInvoker = Record<
  ActionId,
  (input: unknown) => Promise<unknown>
>;

/* NOTE — deliberately absent from ActionContext:
 *   ctx.fetch / ctx.http      → handlers have NO egress. A third-party call is a
 *                               `routine`-kind action (source_type http|integration),
 *                               declared, allowlisted and audited. This is what
 *                               keeps "no egress" structural, not aspirational.
 *   ctx.db / ctx.knex         → no DB handle, ever. Data is reached via actions.
 *   ctx.secrets               → no credentials in the sandbox.
 *   ctx.env / process         → banned by publish lint.
 */

/* ===========================================================================
 * 3. DECLARATION
 * ========================================================================= */

export type SideEffect = 'read' | 'write';

interface ActionBase<TIn extends z.ZodTypeAny, TOut extends z.ZodTypeAny> {
  id: ActionId;
  /** Human label for consent, admin UI and the capability-delta diff at publish. */
  title: string;
  /** Fed to the MCP tool description and chat tool-calling in Phase 5. */
  description?: string;

  input: TIn;
  output: TOut;

  /** Defaults to `id`. Set only to share one capability across several actions. */
  capability?: Capability;

  /** Drives the write-gate and audit classification. */
  sideEffect: SideEffect;

  /** Safe to retry. Required before an action may be exposed externally (Phase 5). */
  idempotent?: boolean;
}

/** Complex logic — code in an ephemeral runtime. One invocation, one context. */
export interface HandlerAction<
  TIn extends z.ZodTypeAny = z.ZodTypeAny,
  TOut extends z.ZodTypeAny = z.ZodTypeAny,
> extends ActionBase<TIn, TOut> {
  kind: 'handler';
  /**
   * Every action id this handler may call. Enforced at runtime by the SDK proxy.
   * This is the analogue of Superblocks' `integrations: {...}` map: the
   * declaration IS the grant.
   */
  uses: readonly ActionId[];
  run(ctx: ActionContext, input: z.infer<TIn>): Promise<z.infer<TOut>>;
}

/** Simple one-shot — the platform's declarative engine. No sandbox, no cold start. */
export interface DeclarativeAction<
  TIn extends z.ZodTypeAny = z.ZodTypeAny,
  TOut extends z.ZodTypeAny = z.ZodTypeAny,
> extends ActionBase<TIn, TOut> {
  kind: 'declarative';
  impl: {
    sourceType: 'platform' | 'integration';
    sourceRef: Record<string, unknown>;
    operation: string;
    /** Binds validated input into the operation. */
    template: unknown;
  };
}

export type ActionDecl<
  TIn extends z.ZodTypeAny = z.ZodTypeAny,
  TOut extends z.ZodTypeAny = z.ZodTypeAny,
> = HandlerAction<TIn, TOut> | DeclarativeAction<TIn, TOut>;

/**
 * The authoring entry point. Mirrors `defineChatTool` — a factory that returns
 * the definition, so the platform can graft on defaults and the type is inferred
 * at the call site rather than annotated.
 *
 *   export default defineAction({
 *     id: 'appointment.reschedule',
 *     title: 'Reschedule appointment',
 *     kind: 'handler',
 *     sideEffect: 'write',
 *     uses: ['appointment.read', 'slot.list', 'appointment.update'],
 *     input:  z.object({ id: z.string(), after: z.string() }),
 *     output: z.object({ rescheduled: z.boolean(), slot: SlotSchema.optional() }),
 *     async run(ctx, input) { ... },
 *   });
 */
export declare function defineAction<
  TIn extends z.ZodTypeAny,
  TOut extends z.ZodTypeAny,
>(decl: ActionDecl<TIn, TOut>): ActionDecl<TIn, TOut>;

// RULE 0 — one zod instance. App code imports `z` from here, never from `zod`
// directly, so the schema an app authors is the exact zod the platform runs.
// The `zod/v4` subpath (NOT bare `zod`) is deliberate: the platform stays on
// classic zod v3, and v3/v4 schema objects are not interoperable.
export { z } from 'zod/v4';
