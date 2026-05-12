import { expect } from 'chai';
import request from 'supertest';
import type init from '~test/init';
import * as internalApi from '~test/factory/internal';
import { untracedCtx } from '~test/factory/internal';
import { OperationLog } from '~/models';

export type Context = Awaited<ReturnType<typeof init>> & { tabId?: string };

export const TAB_ID = 'tab_round_trip_test';

export interface ScopeRef {
  type: 'base' | 'table' | 'view' | 'dashboard' | 'workflow' | 'script';
  id: string;
}

/** Declarative round-trip definition for one operation. */
export interface RoundTripSpec<F = Record<string, any>> {
  /** OperationName recorded on the log row. */
  forward_op: string;
  /** Optional override for the `it()` title — distinguishes specs that
   *  share `forward_op` but exercise different invariants (e.g. the same
   *  service method with vs. without a levels-body, where the undo path
   *  diverges into a different inverse op). */
  label?: string;
  setup: (ctx: Context, env: TestEnv) => Promise<F>;
  /** HTTP call that records the log row (must carry TAB_ID). */
  forward: (ctx: Context, env: TestEnv, fixtures: F) => Promise<request.Response>;
  /** Pull the entity_id from the forward response (mirrors `entry.entity_id`). */
  entityId: (forward: request.Response, fixtures: F) => string;
  assertExists: (
    ctx: Context,
    env: TestEnv,
    fixtures: F,
    entityId: string,
  ) => Promise<void>;
  assertGone: (
    ctx: Context,
    env: TestEnv,
    fixtures: F,
    entityId: string,
  ) => Promise<void>;
  /** Leaf-first scope chain (view → table → base). */
  scope: (env: TestEnv, fixtures: F, entityId: string) => ScopeRef[];
  /** Skip the second undo→redo cycle for ops that consume state (e.g. trashRestore). */
  skipDoubleCycle?: boolean;
  /**
   * When `true`, the forward REMOVES the entity. `assertExists`/`assertGone`
   * keep their literal meaning; the harness picks which one to call after
   * each step.
   */
  forwardIsDelete?: boolean;
  /** Suppress the entity_id equality check (bulk ops record `null`). */
  expectNullEntityId?: boolean;
}

export interface TestEnv {
  workspaceId: string;
  baseId: string;
}

// ── Undo/redo wrappers ────────────────────────────────────────────

export async function undo(
  ctx: Context,
  env: TestEnv,
  scopes: ScopeRef[],
): Promise<request.Response> {
  return internalApi.internalPost(
    ctx,
    env,
    { operation: 'undo' },
    { scopes },
  );
}

async function redo(
  ctx: Context,
  env: TestEnv,
  scopes: ScopeRef[],
): Promise<request.Response> {
  return internalApi.internalPost(
    ctx,
    env,
    { operation: 'redo' },
    { scopes },
  );
}

export async function undoStatus(
  ctx: Context,
  env: TestEnv,
  scopes: ScopeRef[],
): Promise<{ canUndo: boolean; canRedo: boolean }> {
  const r = await internalApi.internalPost(
    ctx,
    env,
    { operation: 'undoStatus' },
    { scopes },
  );
  return r.body;
}

/**
 * Top of the active stack for (user, tab) restricted to the given scope.
 * Matches what `UndoRedoService.undo()` would see — testing what production
 * consumes rather than the raw log table.
 */
export async function topActiveLog(
  ctx: Context,
  env: TestEnv,
  scopes: ScopeRef[],
): Promise<OperationLog | null> {
  return OperationLog.getLatestActive(
    { workspace_id: env.workspaceId, base_id: env.baseId },
    { fk_user_id: ctx.user.id, tab_id: TAB_ID, scopes },
  );
}

// ── The runner ────────────────────────────────────────────────────

/**
 * setup → forward → undo → redo → (optional) undo → redo.
 * Asserts log row shape after forward and that state oscillates stably
 * with the entity id preserved across redo.
 */
export async function runSpec<F extends Record<string, any>>(
  ctx: Context,
  env: TestEnv,
  spec: RoundTripSpec<F>,
): Promise<void> {
  // Setup writes must NOT pollute the per-tab undo stack — the test asserts
  // on the *forward* op as the top of the active stack. Pass an untraced
  // ctx so any internalPost/v3Post inside setup() skips the tab-id header.
  const fixtures = await spec.setup(untracedCtx(ctx), env);

  const forward = await spec.forward(ctx, env, fixtures);
  expect(
    forward.status,
    `[${spec.forward_op}] forward HTTP: ${JSON.stringify(forward.body).slice(0, 400)}`,
  ).to.be.oneOf([200, 201]);
  const entityId = spec.entityId(forward, fixtures);
  expect(entityId, `[${spec.forward_op}] entityId from forward response`).to.be.a('string');

  // For Create/Update the forward leaves the entity present; for Delete it
  // leaves it absent. Pick the asserter pair once, reuse for every step.
  const assertAfterApply = spec.forwardIsDelete ? spec.assertGone : spec.assertExists;
  const assertAfterRevert = spec.forwardIsDelete ? spec.assertExists : spec.assertGone;

  await assertAfterApply(ctx, env, fixtures, entityId);

  const scope = spec.scope(env, fixtures, entityId);

  // What UndoRedoService.undo() would consume: the top of the active stack.
  const row = await topActiveLog(ctx, env, scope);
  expect(row, `[${spec.forward_op}] latest active log row expected within scope`).to.exist;
  expect(row!.forward_op, `[${spec.forward_op}] forward_op`).to.equal(spec.forward_op);
  if (!spec.expectNullEntityId) {
    expect(row!.entity_id, `[${spec.forward_op}] entity_id`).to.equal(entityId);
  }
  expect(row!.status, `[${spec.forward_op}] initial status`).to.equal('active');

  const undoRes = await undo(ctx, env, scope);
  expect(undoRes.status, `[${spec.forward_op}] undo HTTP: ${JSON.stringify(undoRes.body)}`).to.eq(200);
  expect(undoRes.body.status, `[${spec.forward_op}] undo result`).to.equal('ok');
  await assertAfterRevert(ctx, env, fixtures, entityId);

  const redoRes = await redo(ctx, env, scope);
  expect(redoRes.status, `[${spec.forward_op}] redo HTTP: ${JSON.stringify(redoRes.body)}`).to.eq(200);
  expect(redoRes.body.status, `[${spec.forward_op}] redo result`).to.equal('ok');
  await assertAfterApply(ctx, env, fixtures, entityId);

  if (spec.skipDoubleCycle) return;

  const undo2 = await undo(ctx, env, scope);
  expect(undo2.body.status, `[${spec.forward_op}] undo2`).to.equal('ok');
  await assertAfterRevert(ctx, env, fixtures, entityId);
  const redo2 = await redo(ctx, env, scope);
  expect(redo2.body.status, `[${spec.forward_op}] redo2`).to.equal('ok');
  await assertAfterApply(ctx, env, fixtures, entityId);
}

