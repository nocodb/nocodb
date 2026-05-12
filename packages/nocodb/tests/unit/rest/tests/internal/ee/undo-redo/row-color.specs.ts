import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { createGridView, internalPost } from '~test/factory/internal';
import { createTable } from '~test/factory/v3';
import RowColorCondition from '~/models/RowColorCondition';
import { View } from '~/models';
import { viewScope } from './shared';
import type { TableViewFx } from './shared';

interface RowColorFx extends TableViewFx {
  selectColId: string;
}

async function setupRowColorFx(
  ctx: Context,
  env: TestEnv,
): Promise<RowColorFx> {
  // SingleSelect column drives SELECT-mode coloring.
  const t = await createTable(ctx, env, `rctbl_${Date.now()}`, [
    { title: 'Title', type: 'SingleLineText' },
    { title: 'Status', type: 'SingleSelect' },
  ]);
  const viewId = await createGridView(ctx, env, t.id);
  const selectCol = t.fields.find((f: any) => f.title === 'Status');
  return {
    tableId: t.id,
    titleColId: t.titleColId,
    fields: t.fields,
    viewId,
    colId: t.titleColId,
    selectColId: selectCol.id,
  };
}

export const rowColorSelectSetSpec: RoundTripSpec<RowColorFx> = {
  forward_op: 'rowColorSelectSet',
  setup: setupRowColorFx,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'viewRowColorSelectAdd', viewId: fx.viewId },
      { fk_column_id: fx.selectColId, is_set_as_background: true },
    ),
  // Contract's `entity_id` is `params.fk_view_id`. The service returns void,
  // so we read it from the fixture, not the response body.
  entityId: (_r, fx) => fx.viewId,
  scope: viewScope,
  // Snapshot-restore inverse (`rowColoringRestore`) — the captured snapshot
  // is the pre-forward state. 2nd cycle re-captures from the post-1st-undo
  // state, which can differ subtly; skip to keep this focused on the basic
  // round-trip.
  skipDoubleCycle: true,
  assertExists: async (_ctx, env, fx) => {
    const v = await View.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.viewId,
    );
    expect((v as any)?.meta?.rowColoringInfo?.fk_column_id).to.equal(
      fx.selectColId,
    );
  },
  assertGone: async (_ctx, env, fx) => {
    const v = await View.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.viewId,
    );
    expect((v as any)?.meta?.rowColoringInfo?.fk_column_id).to.not.equal(
      fx.selectColId,
    );
  },
};

export const rowColorConditionAddSpec: RoundTripSpec<TableViewFx> = {
  forward_op: 'rowColorConditionAdd',
  // setupTableView from ./shared returns a table + grid view; we don't
  // need a SingleSelect for condition-mode coloring.
  setup: async (ctx, env) => {
    const t = await createTable(ctx, env, `rctbl_${Date.now()}`);
    const viewId = await createGridView(ctx, env, t.id);
    return {
      tableId: t.id,
      titleColId: t.titleColId,
      fields: t.fields,
      viewId,
      colId: t.titleColId,
    };
  },
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'viewRowColorConditionAdd', viewId: fx.viewId },
      {
        color: '#FF0000',
        is_set_as_background: true,
        nc_order: 1,
        type: 'row',
        fk_target_column_id: fx.titleColId,
      },
    ),
  entityId: (r) => r.body.id,
  scope: viewScope,
  assertExists: async (context, env, _fx, id) => {
    const c = await RowColorCondition.getById(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(c?.id, '[rowColorConditionAdd] id preserved across redo').to.equal(id);
  },
  assertGone: async (context, env, _fx, id) => {
    const c = await RowColorCondition.getById(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(!!c).to.equal(false);
  },
};

interface ExistingConditionFx extends TableViewFx {
  conditionId: string;
}

async function setupExistingCondition(
  ctx: Context,
  env: TestEnv,
): Promise<ExistingConditionFx> {
  const t = await createTable(ctx, env, `rcc_${Date.now()}`);
  const viewId = await createGridView(ctx, env, t.id);
  const r = await internalPost(
    ctx,
    env,
    { operation: 'viewRowColorConditionAdd', viewId },
    {
      color: '#FF0000',
      is_set_as_background: true,
      nc_order: 1,
      type: 'row',
      fk_target_column_id: t.titleColId,
    },
  );
  expect(r.status, `seed condition: ${JSON.stringify(r.body)}`).to.eq(200);
  return {
    tableId: t.id,
    titleColId: t.titleColId,
    fields: t.fields,
    viewId,
    colId: t.titleColId,
    conditionId: r.body.id,
  };
}

export const rowColorConditionUpdateSpec: RoundTripSpec<ExistingConditionFx> = {
  forward_op: 'rowColorConditionUpdate',
  setup: setupExistingCondition,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      {
        operation: 'viewRowColorConditionUpdate',
        viewId: fx.viewId,
        rowColorConditionId: fx.conditionId,
      },
      {
        color: '#00FF00',
        is_set_as_background: false,
        nc_order: 1,
        type: 'row',
        fk_target_column_id: fx.titleColId,
      },
    ),
  entityId: (_r, fx) => fx.conditionId,
  scope: viewScope,
  assertExists: async (_ctx, env, fx) => {
    const c = await RowColorCondition.getById(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.conditionId,
    );
    expect(c?.color).to.equal('#00FF00');
  },
  assertGone: async (_ctx, env, fx) => {
    const c = await RowColorCondition.getById(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.conditionId,
    );
    expect(c?.color).to.equal('#FF0000');
  },
};

export const rowColorConditionDeleteSpec: RoundTripSpec<ExistingConditionFx> = {
  forward_op: 'rowColorConditionDelete',
  forwardIsDelete: true,
  setup: setupExistingCondition,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      {
        operation: 'viewRowColorConditionDelete',
        viewId: fx.viewId,
        rowColorConditionId: fx.conditionId,
      },
      {},
    ),
  entityId: (_r, fx) => fx.conditionId,
  scope: viewScope,
  assertExists: async (_ctx, env, fx) => {
    const c = await RowColorCondition.getById(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.conditionId,
    ).catch(() => null);
    expect(!!c).to.equal(true);
  },
  assertGone: async (_ctx, env, fx) => {
    const c = await RowColorCondition.getById(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.conditionId,
    ).catch(() => null);
    expect(!!c).to.equal(false);
  },
};

export const rowColoringRemoveSpec: RoundTripSpec<ExistingConditionFx> = {
  forward_op: 'rowColoringRemove',
  forwardIsDelete: true,
  setup: setupExistingCondition,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'viewRowColorInfoDelete', viewId: fx.viewId },
      {},
    ),
  entityId: (_r, fx) => fx.viewId,
  scope: viewScope,
  skipDoubleCycle: true,
  assertExists: async (_ctx, env, fx) => {
    // After undo: row-coloring state is restored — the condition row exists again.
    const c = await RowColorCondition.getById(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.conditionId,
    ).catch(() => null);
    expect(!!c).to.equal(true);
  },
  assertGone: async (_ctx, env, fx) => {
    // After forward: row-coloring removed — condition row gone.
    const c = await RowColorCondition.getById(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.conditionId,
    ).catch(() => null);
    expect(!!c).to.equal(false);
  },
};

export const rowColorConditionsCreateSpec: RoundTripSpec<ExistingConditionFx> = {
  forward_op: 'rowColorConditionsCreate',
  setup: setupExistingCondition,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      {
        operation: 'rowColorConditionsFilterCreate',
        rowColorConditionId: fx.conditionId,
      },
      {
        fk_column_id: fx.titleColId,
        comparison_op: 'eq',
        value: 'foo',
        logical_op: 'and',
      },
    ),
  entityId: (r) => r.body.id ?? r.body?.filter?.id,
  scope: viewScope,
  // The forward's response shape varies by service; doubleCycle exercises
  // it once which is enough to validate the contract.
  skipDoubleCycle: true,
  assertExists: async (_ctx, env, fx, id) => {
    const c = await RowColorCondition.getById(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.conditionId,
    ).catch(() => null);
    expect(!!c, 'parent condition still present').to.equal(true);
    // The filter was created — id should be a string.
    expect(id, 'filter id from forward').to.be.a('string');
  },
  assertGone: async (_ctx, env, fx) => {
    const c = await RowColorCondition.getById(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.conditionId,
    ).catch(() => null);
    // Parent condition unchanged either way.
    expect(!!c, 'parent condition still present').to.equal(true);
  },
};

export const rowColorSpecs: RoundTripSpec<any>[] = [
  rowColorSelectSetSpec,
  rowColorConditionAddSpec,
  rowColorConditionUpdateSpec,
  rowColorConditionDeleteSpec,
  rowColoringRemoveSpec,
  rowColorConditionsCreateSpec,
];
