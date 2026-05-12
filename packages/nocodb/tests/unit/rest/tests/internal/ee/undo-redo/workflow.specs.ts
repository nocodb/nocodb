import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { internalPost } from '~test/factory/internal';
import { Workflow } from '~/models';
import { baseScope } from '~test/rest/tests/internal/ee/undo-redo/shared';

export const workflowCreateSpec: RoundTripSpec<{}> = {
  forward_op: 'workflowCreate',
  setup: async () => ({}),
  forward: (ctx, env) =>
    internalPost(
      ctx,
      env,
      { operation: 'workflowCreate' },
      { title: `WF_${Date.now()}` }
    ),
  entityId: (r) => r.body.id,
  scope: baseScope,
  assertExists: async (ctx, env, _fx, id) => {
    const w = await Workflow.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(w?.id, '[workflowCreate] id preserved across redo').to.equal(id);
  },
  assertGone: async (ctx, env, _fx, id) => {
    const w = await Workflow.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(!!w).to.equal(false);
  },
};

interface WfFx {
  workflowId: string;
  originalTitle: string;
}

async function setupWorkflow(ctx: Context, env: TestEnv): Promise<WfFx> {
  const title = `WF_${Date.now()}`;
  const r = await internalPost(
    ctx,
    env,
    { operation: 'workflowCreate' },
    { title },
  );
  return { workflowId: r.body.id, originalTitle: title };
}

export const workflowUpdateSpec: RoundTripSpec<WfFx> = {
  forward_op: 'workflowUpdate',
  setup: setupWorkflow,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'workflowUpdate', workflowId: fx.workflowId },
      { title: 'WFRenamed' }
    ),
  entityId: (_r, fx) => fx.workflowId,
  // Rename-only is base-scoped.
  scope: (env) => [{ type: 'base', id: env.baseId }],
  assertExists: async (_ctx, env, fx) => {
    const w = await Workflow.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.workflowId,
    );
    expect(w.title).to.equal('WFRenamed');
  },
  assertGone: async (_ctx, env, fx) => {
    const w = await Workflow.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.workflowId,
    );
    expect(w.title).to.equal(fx.originalTitle);
  },
};

export const workflowDeleteSpec: RoundTripSpec<WfFx> = {
  forward_op: 'workflowDelete',
  forwardIsDelete: true,
  setup: setupWorkflow,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      // workflowDelete reads workflowId from BODY
      // (WorkflowPost.operations.ts:61).
      { operation: 'workflowDelete' },
      { workflowId: fx.workflowId }
    ),
  entityId: (_r, fx) => fx.workflowId,
  scope: baseScope,
  assertExists: async (_ctx, env, fx) => {
    const w = await Workflow.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.workflowId,
    ).catch(() => null);
    expect(!!w).to.equal(true);
  },
  assertGone: async (_ctx, env, fx) => {
    const w = await Workflow.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.workflowId,
    ).catch(() => null);
    expect(!!w).to.equal(false);
  },
};

// ── workflowDuplicate ────────────────────────────────────────────
//
// `workflowDuplicate` reads `payload.workflowId` for the source workflow
// and returns the new workflow.

export const workflowDuplicateSpec: RoundTripSpec<WfFx> = {
  forward_op: 'workflowDuplicate',
  setup: setupWorkflow,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'workflowDuplicate' },
      { workflowId: fx.workflowId },
    ),
  entityId: (r) => r.body.id,
  scope: baseScope,
  assertExists: async (_ctx, env, _fx, id) => {
    const w = await Workflow.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(w?.id, '[workflowDuplicate] duplicate exists').to.equal(id);
  },
  assertGone: async (_ctx, env, _fx, id) => {
    const w = await Workflow.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(!!w, '[workflowDuplicate] duplicate gone after undo').to.equal(false);
  },
};

export const workflowSpecs: RoundTripSpec<any>[] = [
  workflowCreateSpec,
  workflowUpdateSpec,
  workflowDeleteSpec,
  workflowDuplicateSpec,
];
