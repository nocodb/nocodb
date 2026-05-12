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

export const rowColorSpecs: RoundTripSpec<any>[] = [
  rowColorSelectSetSpec,
  rowColorConditionAddSpec,
];
