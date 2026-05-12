import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { internalPost, readColumns } from '~test/factory/internal';
import { createTable, v3Delete, v3Patch, v3Post } from '~test/factory/v3';
import { colExists, tableScope } from '~test/rest/tests/internal/ee/undo-redo/shared';

interface ColFx {
  tableId: string;
  titleColId: string;
}

async function setupTableForCol(ctx: Context, env: TestEnv): Promise<ColFx> {
  const t = await createTable(ctx, env, `cTbl_${Date.now()}`);
  return { tableId: t.id, titleColId: t.titleColId };
}

export const columnAddSpec: RoundTripSpec<ColFx> = {
  forward_op: 'columnAdd',
  setup: setupTableForCol,
  // The internal `columnAdd` returns the parent **Model** (V1 default
  // shape) — `r.body.id` would be the table id, not the column id, so the
  // round-trip asserts would look for the wrong entity. v3 REST returns
  // the **Column** directly (`columnsService.columnAdd<NcApiVersion.V3>`),
  // which is what `entityId` needs. Both routes call the same service
  // method carrying @TraceCommand(columnAdd).
  forward: (ctx, env, fx) =>
    v3Post(
      ctx,
      `/api/v3/meta/bases/${env.baseId}/tables/${fx.tableId}/fields`,
      { title: 'NewCol', type: 'SingleLineText' }
    ),
  entityId: (r) => r.body.id,
  scope: tableScope,
  assertExists: async (ctx, env, fx, id) => {
    expect(await colExists(env, fx.tableId, id)).to.equal(true);
  },
  assertGone: async (ctx, env, fx, id) => {
    expect(await colExists(env, fx.tableId, id)).to.equal(false);
  },
};

interface ColUpdateFx extends ColFx {
  newColId: string;
}

async function setupExistingCol(
  ctx: Context,
  env: TestEnv,
): Promise<ColUpdateFx> {
  const base = await setupTableForCol(ctx, env);
  const added = await v3Post(
    ctx,
    `/api/v3/meta/bases/${env.baseId}/tables/${base.tableId}/fields`,
    { title: 'OriginalCol', type: 'SingleLineText' },
  );
  return { ...base, newColId: added.body.id };
}

export const columnUpdateSpec: RoundTripSpec<ColUpdateFx> = {
  forward_op: 'columnUpdate',
  setup: setupExistingCol,
  // v3 — same reason as columnAdd: response/lookup uses column id, not table id.
  forward: (ctx, env, fx) =>
    v3Patch(
      ctx,
      `/api/v3/meta/bases/${env.baseId}/tables/${fx.tableId}/fields/${fx.newColId}`,
      { title: 'RenamedCol' }
    ),
  entityId: (_r, fx) => fx.newColId,
  scope: tableScope,
  assertExists: async (_ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    const col = cols.find((c: any) => c.id === fx.newColId);
    expect(col?.title).to.equal('RenamedCol');
  },
  assertGone: async (_ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    const col = cols.find((c: any) => c.id === fx.newColId);
    expect(col?.title).to.equal('OriginalCol');
  },
};

export const columnDeleteSpec: RoundTripSpec<ColUpdateFx> = {
  forward_op: 'columnDelete',
  forwardIsDelete: true,
  setup: setupExistingCol,
  forward: (ctx, env, fx) =>
    v3Delete(
      ctx,
      `/api/v3/meta/bases/${env.baseId}/tables/${fx.tableId}/fields/${fx.newColId}`
    ),
  entityId: (_r, fx) => fx.newColId,
  scope: tableScope,
  assertExists: async (ctx, env, fx) => {
    expect(await colExists(env, fx.tableId, fx.newColId)).to.equal(true);
  },
  assertGone: async (ctx, env, fx) => {
    expect(await colExists(env, fx.tableId, fx.newColId)).to.equal(false);
  },
};

// ── columnSetAsPrimary ────────────────────────────────────────────

interface PrimaryFx {
  tableId: string;
  newPrimaryColId: string;
  originalPrimaryColId: string;
}

async function setupTwoColumns(
  ctx: Context,
  env: TestEnv,
): Promise<PrimaryFx> {
  const t = await createTable(ctx, env, `pTbl_${Date.now()}`, [
    { title: 'Title', type: 'SingleLineText' },
    { title: 'Notes', type: 'SingleLineText' },
  ]);
  // First column is the default primary (pv=true).
  const originalPrimaryColId = t.fields.find((f: any) => f.pv)?.id ?? t.titleColId;
  const notesCol = t.fields.find((f: any) => f.title === 'Notes');
  return {
    tableId: t.id,
    newPrimaryColId: notesCol.id,
    originalPrimaryColId,
  };
}

export const columnSetAsPrimarySpec: RoundTripSpec<PrimaryFx> = {
  forward_op: 'columnSetAsPrimary',
  setup: setupTwoColumns,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      {
        operation: 'columnSetAsPrimary',
        tableId: fx.tableId,
        columnId: fx.newPrimaryColId,
      },
      {}
    ),
  entityId: (_r, fx) => fx.newPrimaryColId,
  scope: (env, fx) => [
    { type: 'table', id: fx.tableId },
    { type: 'base', id: env.baseId },
  ],
  assertExists: async (_ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    const primary = cols.find((c: any) => c.pv);
    expect(primary?.id).to.equal(fx.newPrimaryColId);
  },
  assertGone: async (_ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    const primary = cols.find((c: any) => c.pv);
    expect(primary?.id).to.equal(fx.originalPrimaryColId);
  },
};

export const columnSpecs: RoundTripSpec<any>[] = [
  columnAddSpec,
  columnUpdateSpec,
  columnDeleteSpec,
  columnSetAsPrimarySpec,
];
