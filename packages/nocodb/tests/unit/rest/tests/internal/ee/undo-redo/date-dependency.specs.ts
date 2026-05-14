import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { internalPost, untracedCtx } from '~test/factory/internal';
import { createTable, v3Post } from '~test/factory/v3';
import { DateDependency } from '~/models';
import { tableScope } from '~test/rest/tests/internal/ee/undo-redo/shared';

interface DateDepFx {
  tableId: string;
  startColId: string;
  endColId: string;
}

async function setupTableWithDateCols(
  ctx: Context,
  env: TestEnv,
): Promise<DateDepFx> {
  const untraced = untracedCtx(ctx);
  const t = await createTable(untraced, env, `ddTbl_${Date.now()}`);

  const startRes = await v3Post(
    untraced,
    `/api/v3/meta/bases/${env.baseId}/tables/${t.id}/fields`,
    { title: 'Start', type: 'Date' },
  );
  expect(startRes.status, `start col: ${JSON.stringify(startRes.body)}`).to.eq(200);
  const endRes = await v3Post(
    untraced,
    `/api/v3/meta/bases/${env.baseId}/tables/${t.id}/fields`,
    { title: 'End', type: 'Date' },
  );
  expect(endRes.status, `end col: ${JSON.stringify(endRes.body)}`).to.eq(200);

  return {
    tableId: t.id,
    startColId: startRes.body.id,
    endColId: endRes.body.id,
  };
}
export const dateDependencyUpdateSpec: RoundTripSpec<DateDepFx> = {
  forward_op: 'dateDependencyUpdate',
  setup: setupTableWithDateCols,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'updateDateDependency', modelId: fx.tableId },
      {
        fk_start_date_field_id: fx.startColId,
        fk_end_date_field_id: fx.endColId,
        include_weekends: false,
        is_active: true,
      },
    ),
  entityId: (_r, fx) => fx.tableId,
  skipDoubleCycle: true,
  scope: tableScope,
  assertExists: async (_ctx, env, fx) => {
    const row = await DateDependency.getByModelId(
      { workspace_id: env.workspaceId, base_id: env.baseId } as any,
      fx.tableId,
    );
    expect(!!row, '[dateDependencyUpdate] row inserted').to.equal(true);
    expect(
      (row as any)?.fk_start_date_field_id,
      '[dateDependencyUpdate] start col linked',
    ).to.equal(fx.startColId);
  },
  assertGone: async (_ctx, env, fx) => {
    const row = await DateDependency.getByModelId(
      { workspace_id: env.workspaceId, base_id: env.baseId } as any,
      fx.tableId,
    );
    expect(!!row, '[dateDependencyUpdate] row removed after undo').to.equal(false);
  },
};

async function setupExistingDateDependency(
  ctx: Context,
  env: TestEnv,
): Promise<DateDepFx> {
  const fx = await setupTableWithDateCols(ctx, env);
  const untraced = untracedCtx(ctx);
  const seed = await internalPost(
    untraced,
    env,
    { operation: 'updateDateDependency', modelId: fx.tableId },
    {
      fk_start_date_field_id: fx.startColId,
      fk_end_date_field_id: fx.endColId,
      include_weekends: false,
      is_active: true,
    },
  );
  expect(seed.status, `seed dep: ${JSON.stringify(seed.body)}`).to.eq(200);
  return fx;
}

export const dateDependencyDeleteSpec: RoundTripSpec<DateDepFx> = {
  forward_op: 'dateDependencyDelete',
  forwardIsDelete: true,
  setup: setupExistingDateDependency,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'deleteTableDateDependency', modelId: fx.tableId },
      {},
    ),
  entityId: (_r, fx) => fx.tableId,
  scope: tableScope,
  skipDoubleCycle: true,
  assertExists: async (_ctx, env, fx) => {
    // Pre-forward (and after undo): row exists.
    const row = await DateDependency.getByModelId(
      { workspace_id: env.workspaceId, base_id: env.baseId } as any,
      fx.tableId,
    );
    expect(!!row, '[dateDependencyDelete] row exists').to.equal(true);
  },
  assertGone: async (_ctx, env, fx) => {
    const row = await DateDependency.getByModelId(
      { workspace_id: env.workspaceId, base_id: env.baseId } as any,
      fx.tableId,
    );
    expect(!!row, '[dateDependencyDelete] row deleted').to.equal(false);
  },
};

export const dateDependencySpecs: RoundTripSpec<any>[] = [
  dateDependencyUpdateSpec,
  dateDependencyDeleteSpec,
];
