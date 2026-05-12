import { expect } from 'chai';
import type { Context, RoundTripSpec, ScopeRef, TestEnv } from './harness';
import { internalPost } from '~test/factory/internal';
import { Widget } from '~/models';

interface DashFx {
  dashboardId: string;
}

async function setupDashboard(ctx: Context, env: TestEnv): Promise<DashFx> {
  const d = await internalPost(
    ctx,
    env,
    { operation: 'dashboardCreate' },
    { title: `D_${Date.now()}` },
  );
  expect(d.status).to.eq(200);
  return { dashboardId: d.body.id };
}

function dashboardScope(env: TestEnv, fx: DashFx): ScopeRef[] {
  return [
    { type: 'dashboard', id: fx.dashboardId },
    { type: 'base', id: env.baseId },
  ];
}

export const widgetCreateSpec: RoundTripSpec<DashFx> = {
  forward_op: 'widgetCreate',
  setup: setupDashboard,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'widgetCreate' },
      {
        title: 'W',
        type: 'text',
        position: { x: 0, y: 0, w: 4, h: 4 },
        meta: {},
        fk_dashboard_id: fx.dashboardId,
      }
    ),
  entityId: (r) => r.body.id,
  scope: dashboardScope,
  assertExists: async (ctx, env, _fx, id) => {
    const w = await Widget.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(w?.id, '[widgetCreate] id preserved across redo').to.equal(id);
  },
  assertGone: async (ctx, env, _fx, id) => {
    const w = await Widget.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(!!w).to.equal(false);
  },
};

// ── Widget update / delete ────────────────────────────────────────

interface WidgetFx extends DashFx {
  widgetId: string;
  originalTitle: string;
}

async function setupExistingWidget(
  ctx: Context,
  env: TestEnv,
): Promise<WidgetFx> {
  const d = await setupDashboard(ctx, env);
  const title = `W_${Date.now()}`;
  const r = await internalPost(
    ctx,
    env,
    { operation: 'widgetCreate' },
    {
      title,
      type: 'text',
      position: { x: 0, y: 0, w: 4, h: 4 },
      meta: {},
      fk_dashboard_id: d.dashboardId,
    },
  );
  return { ...d, widgetId: r.body.id, originalTitle: title };
}

export const widgetUpdateSpec: RoundTripSpec<WidgetFx> = {
  forward_op: 'widgetUpdate',
  setup: setupExistingWidget,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'widgetUpdate', widgetId: fx.widgetId },
      { title: 'WRenamed' }
    ),
  entityId: (_r, fx) => fx.widgetId,
  scope: dashboardScope,
  assertExists: async (_ctx, env, fx) => {
    const w = await Widget.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.widgetId,
    );
    expect(w.title).to.equal('WRenamed');
  },
  assertGone: async (_ctx, env, fx) => {
    const w = await Widget.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.widgetId,
    );
    expect(w.title).to.equal(fx.originalTitle);
  },
};

export const widgetDeleteSpec: RoundTripSpec<WidgetFx> = {
  forward_op: 'widgetDelete',
  forwardIsDelete: true,
  setup: setupExistingWidget,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      // widgetDelete reads widgetId from BODY (internal.controller:540).
      { operation: 'widgetDelete' },
      { widgetId: fx.widgetId }
    ),
  entityId: (_r, fx) => fx.widgetId,
  scope: dashboardScope,
  assertExists: async (_ctx, env, fx) => {
    const w = await Widget.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.widgetId,
    ).catch(() => null);
    expect(!!w).to.equal(true);
  },
  assertGone: async (_ctx, env, fx) => {
    const w = await Widget.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.widgetId,
    ).catch(() => null);
    expect(!!w).to.equal(false);
  },
};

export const widgetSpecs: RoundTripSpec<any>[] = [
  widgetCreateSpec,
  widgetUpdateSpec,
  widgetDeleteSpec,
];
