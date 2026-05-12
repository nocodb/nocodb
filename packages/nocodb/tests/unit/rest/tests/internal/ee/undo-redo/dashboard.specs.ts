import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { internalPost } from '~test/factory/internal';
import { Dashboard } from '~/models';
import { baseScope } from '~test/rest/tests/internal/ee/undo-redo/shared';

export const dashboardCreateSpec: RoundTripSpec<{}> = {
  forward_op: 'dashboardCreate',
  setup: async () => ({}),
  forward: (ctx, env) =>
    internalPost(
      ctx,
      env,
      { operation: 'dashboardCreate' },
      { title: `Dashboard_${Date.now()}` }
    ),
  entityId: (r) => r.body.id,
  scope: baseScope,
  assertExists: async (ctx, env, _fx, id) => {
    const d = await Dashboard.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(d?.id, '[dashboardCreate] id preserved across redo').to.equal(id);
  },
  assertGone: async (ctx, env, _fx, id) => {
    const d = await Dashboard.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(!!d).to.equal(false);
  },
};

interface DashUpdFx {
  dashboardId: string;
  originalTitle: string;
}

async function setupExistingDashboard(
  ctx: Context,
  env: TestEnv,
): Promise<DashUpdFx> {
  const title = `Dash_${Date.now()}`;
  const r = await internalPost(
    ctx,
    env,
    { operation: 'dashboardCreate' },
    { title },
  );
  return { dashboardId: r.body.id, originalTitle: title };
}

export const dashboardUpdateSpec: RoundTripSpec<DashUpdFx> = {
  forward_op: 'dashboardUpdate',
  setup: setupExistingDashboard,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'dashboardUpdate', dashboardId: fx.dashboardId },
      { title: 'DashRenamed' }
    ),
  entityId: (_r, fx) => fx.dashboardId,
  // Rename-only dashboardUpdate is BASE-scoped (dynamicScope sidebar rule).
  scope: (env) => [{ type: 'base', id: env.baseId }],
  assertExists: async (_ctx, env, fx) => {
    const d = await Dashboard.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.dashboardId,
    );
    expect(d.title).to.equal('DashRenamed');
  },
  assertGone: async (_ctx, env, fx) => {
    const d = await Dashboard.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.dashboardId,
    );
    expect(d.title).to.equal(fx.originalTitle);
  },
};

export const dashboardDeleteSpec: RoundTripSpec<DashUpdFx> = {
  forward_op: 'dashboardDelete',
  forwardIsDelete: true,
  setup: setupExistingDashboard,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      // dashboardDelete reads dashboardId from BODY (internal.controller:517),
      // unlike dashboardUpdate which reads it from the query.
      { operation: 'dashboardDelete' },
      { dashboardId: fx.dashboardId }
    ),
  entityId: (_r, fx) => fx.dashboardId,
  scope: baseScope,
  assertExists: async (_ctx, env, fx) => {
    const d = await Dashboard.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.dashboardId,
    ).catch(() => null);
    expect(!!d).to.equal(true);
  },
  assertGone: async (_ctx, env, fx) => {
    const d = await Dashboard.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.dashboardId,
    ).catch(() => null);
    expect(!!d).to.equal(false);
  },
};

export const dashboardSpecs: RoundTripSpec<any>[] = [
  dashboardCreateSpec,
  dashboardUpdateSpec,
  dashboardDeleteSpec,
];
