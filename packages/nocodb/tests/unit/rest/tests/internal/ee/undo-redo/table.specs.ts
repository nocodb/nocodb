import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { internalPost } from '~test/factory/internal';
import { createTable, v3Patch, v3Post } from '~test/factory/v3';
import { Model } from '~/models';
import { baseScope, noSetup, tableExists } from '~test/rest/tests/internal/ee/undo-redo/shared';
import type { NoFx } from '~test/rest/tests/internal/ee/undo-redo/shared';

export const tableV3CreateSpec: RoundTripSpec<NoFx> = {
  forward_op: 'tableV3Create',
  setup: noSetup,
  forward: (ctx, env) =>
    v3Post(
      ctx,
      `/api/v3/meta/bases/${env.baseId}/tables`,
      {
        title: `TblV3_${Date.now()}`,
        fields: [{ title: 'Title', type: 'SingleLineText' }],
      }
    ),
  entityId: (r) => r.body.id,
  scope: (env) => baseScope(env),
  assertExists: async (ctx, env, _fx, id) => {
    expect(await tableExists(ctx, env, id)).to.equal(true);
  },
  assertGone: async (ctx, env, _fx, id) => {
    expect(await tableExists(ctx, env, id)).to.equal(false);
  },
};

interface TableUpdFx {
  tableId: string;
  originalTitle: string;
}

async function setupExistingTable(
  ctx: Context,
  env: TestEnv,
): Promise<TableUpdFx> {
  const title = `TblExisting_${Date.now()}`;
  const t = await createTable(ctx, env, title);
  return { tableId: t.id, originalTitle: title };
}

export const tableUpdateSpec: RoundTripSpec<TableUpdFx> = {
  forward_op: 'tableUpdate',
  setup: setupExistingTable,
  forward: (ctx, env, fx) =>
    v3Patch(
      ctx,
      `/api/v3/meta/bases/${env.baseId}/tables/${fx.tableId}`,
      { title: 'TableRenamed' }
    ),
  entityId: (_r, fx) => fx.tableId,
  scope: baseScope,
  assertExists: async (ctx, env, fx) => {
    const m = await Model.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.tableId,
    );
    expect(m.title).to.equal('TableRenamed');
  },
  assertGone: async (ctx, env, fx) => {
    const m = await Model.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.tableId,
    );
    expect(m.title).to.equal(fx.originalTitle);
  },
};

export const tableDeleteSpec: RoundTripSpec<TableUpdFx> = {
  forward_op: 'tableDelete',
  forwardIsDelete: true,
  setup: setupExistingTable,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'tableDelete', tableId: fx.tableId },
      {}
    ),
  entityId: (_r, fx) => fx.tableId,
  scope: baseScope,
  assertExists: async (ctx, env, fx) => {
    expect(await tableExists(ctx, env, fx.tableId)).to.equal(true);
  },
  assertGone: async (ctx, env, fx) => {
    expect(await tableExists(ctx, env, fx.tableId)).to.equal(false);
  },
};

// ── Table reorder ─────────────────────────────────────────────────

interface ReorderFx {
  tableAId: string;
  tableBId: string;
  originalAOrder: number;
}

async function setupTwoTables(
  ctx: Context,
  env: TestEnv,
): Promise<ReorderFx> {
  const a = await createTable(ctx, env, `TblA_${Date.now()}`);
  const b = await createTable(ctx, env, `TblB_${Date.now()}`);
  const mA = await Model.get(
    { workspace_id: env.workspaceId, base_id: env.baseId },
    a.id,
  );
  return {
    tableAId: a.id,
    tableBId: b.id,
    originalAOrder: (mA as any).order ?? 0,
  };
}

export const tableReorderSpec: RoundTripSpec<ReorderFx> = {
  forward_op: 'tableReorder',
  setup: setupTwoTables,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'tableReorder', tableId: fx.tableAId },
      { order: 99 }
    ),
  entityId: (_r, fx) => fx.tableAId,
  scope: (env) => [{ type: 'base', id: env.baseId }],
  assertExists: async (_ctx, env, fx) => {
    const m = await Model.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.tableAId,
    );
    expect((m as any).order).to.equal(99);
  },
  assertGone: async (_ctx, env, fx) => {
    const m = await Model.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.tableAId,
    );
    expect((m as any).order).to.equal(fx.originalAOrder);
  },
};

export const tableSpecs: RoundTripSpec<any>[] = [
  tableV3CreateSpec,
  tableUpdateSpec,
  tableDeleteSpec,
  tableReorderSpec,
];
