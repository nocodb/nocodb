import { expect } from 'chai';
import type { Context, RoundTripSpec, ScopeRef, TestEnv } from './harness';
import { internalPost } from '~test/factory/internal';
import { createTable } from '~test/factory/v3';
import { Filter, Widget } from '~/models';

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

export const widgetDuplicateSpec: RoundTripSpec<WidgetFx> = {
  forward_op: 'duplicateWidget',
  setup: setupExistingWidget,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'widgetDuplicate' },
      { widgetId: fx.widgetId },
    ),
  entityId: (r) => r.body?.id ?? r.body?.widget?.id,
  scope: dashboardScope,
  assertExists: async (_ctx, env, _fx, id) => {
    const w = await Widget.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(w?.id, '[widgetDuplicate] duplicated widget exists').to.equal(id);
  },
  assertGone: async (_ctx, env, _fx, id) => {
    const w = await Widget.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(!!w, '[widgetDuplicate] duplicate gone after undo').to.equal(false);
  },
};

interface WidgetFilterFx extends DashFx {
  widgetId: string;
  titleColId: string;
}

async function setupWidgetWithModel(
  ctx: Context,
  env: TestEnv,
): Promise<WidgetFilterFx> {
  const t = await createTable(ctx, env, `wfTbl_${Date.now()}`);
  const d = await setupDashboard(ctx, env);
  const w = await internalPost(
    ctx,
    env,
    { operation: 'widgetCreate' },
    {
      title: 'W',
      type: 'text',
      position: { x: 0, y: 0, w: 4, h: 4 },
      meta: {},
      fk_dashboard_id: d.dashboardId,
      fk_model_id: t.id,
    },
  );
  expect(w.status, `widgetCreate: ${JSON.stringify(w.body)}`).to.eq(200);
  return {
    dashboardId: d.dashboardId,
    widgetId: w.body.id,
    titleColId: t.titleColId,
  };
}

export const widgetFilterCreateSpec: RoundTripSpec<WidgetFilterFx> = {
  forward_op: 'widgetFilterCreate',
  setup: setupWidgetWithModel,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'widgetFilterCreate', widgetId: fx.widgetId },
      {
        fk_column_id: fx.titleColId,
        comparison_op: 'eq',
        value: 'foo',
        logical_op: 'and',
      },
    ),
  entityId: (r) => r.body.id,
  scope: (env, fx) => [
    { type: 'dashboard', id: fx.dashboardId },
    { type: 'base', id: env.baseId },
  ],
  assertExists: async (_ctx, env, _fx, id) => {
    const f = await Filter.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(f?.id, '[widgetFilterCreate] id preserved across redo').to.equal(id);
  },
  assertGone: async (_ctx, env, _fx, id) => {
    const f = await Filter.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(!!f).to.equal(false);
  },
};

export const widgetSpecs: RoundTripSpec<any>[] = [
  widgetCreateSpec,
  widgetUpdateSpec,
  widgetDeleteSpec,
  widgetDuplicateSpec,
  widgetFilterCreateSpec,
];
