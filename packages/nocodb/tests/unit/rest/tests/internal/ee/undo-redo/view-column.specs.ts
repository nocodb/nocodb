import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import {
  createGridView,
  internalPost,
  readViewColumns,
} from '~test/factory/internal';
import { createTable } from '~test/factory/v3';
import { viewScope } from '~test/rest/tests/internal/ee/undo-redo/shared';
import type { TableViewFx } from '~test/rest/tests/internal/ee/undo-redo/shared';

// ── View column visibility ────────────────────────────────────────

interface ViewColFx extends TableViewFx {
  viewColumnId: string;
}

async function setupViewColumn(ctx: Context, env: TestEnv): Promise<ViewColFx> {
  // View.updateColumn (models/View.ts:1355) force-pins `show: true` for the
  // primary-value column on grid views, so we can't hide the Title column.
  // Create a second non-PV column and toggle its view-column visibility.
  const tbl = await createTable(ctx, env, `tbl_${Date.now()}`, [
    { title: 'Title', type: 'SingleLineText' },
    { title: 'Notes', type: 'SingleLineText' },
  ]);
  const viewId = await createGridView(ctx, env, tbl.id);
  const notesCol = tbl.fields.find((f: any) => f.title === 'Notes');
  expect(notesCol, 'notes column must exist').to.exist;
  const list = await readViewColumns(ctx, env, viewId);
  const notesViewCol = list.find((c: any) => c.fk_column_id === notesCol.id);
  expect(notesViewCol, 'notes view-column must exist').to.exist;
  return {
    tableId: tbl.id,
    titleColId: tbl.titleColId,
    fields: tbl.fields,
    viewId,
    colId: tbl.titleColId,
    viewColumnId: notesViewCol.id,
  };
}

export const viewColumnUpdateSpec: RoundTripSpec<ViewColFx> = {
  forward_op: 'viewColumnUpdate',
  setup: setupViewColumn,
  // Controller reads `req.query.columnId` (UiPost.operations.ts:274) — the
  // frontend `useViewColumns` also sends `columnId`, despite the value
  // being the view-column row id (not the model column id). Naming is
  // confusing but the wire shape is fixed.
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      {
        operation: 'viewColumnUpdate',
        viewId: fx.viewId,
        columnId: fx.viewColumnId,
      },
      { show: false }
    ),
  entityId: (_r, fx) => fx.viewColumnId,
  scope: viewScope,
  assertExists: async (ctx, env, fx) => {
    const list = await readViewColumns(ctx, env, fx.viewId);
    const row = list.find((c: any) => c.id === fx.viewColumnId);
    expect(!!row?.show).to.equal(false);
  },
  assertGone: async (ctx, env, fx) => {
    const list = await readViewColumns(ctx, env, fx.viewId);
    const row = list.find((c: any) => c.id === fx.viewColumnId);
    expect(!!row?.show).to.equal(true);
  },
};

interface GridColFx {
  tableId: string;
  viewId: string;
  gridViewColumnId: string;
}

async function setupGridColumn(ctx: Context, env: TestEnv): Promise<GridColFx> {
  const t = await createTable(ctx, env, `gcTbl_${Date.now()}`);
  const viewId = await createGridView(ctx, env, t.id);
  const cols = await readViewColumns(ctx, env, viewId);
  const titleCol = cols.find((c: any) => c.fk_column_id === t.titleColId);
  expect(titleCol, 'title view-column must exist').to.exist;
  return { tableId: t.id, viewId, gridViewColumnId: titleCol.id };
}

export const gridColumnUpdateSpec: RoundTripSpec<GridColFx> = {
  forward_op: 'gridColumnUpdate',
  setup: setupGridColumn,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      {
        operation: 'gridColumnUpdate',
        gridViewColumnId: fx.gridViewColumnId,
      },
      { width: '250px' },
    ),
  entityId: (_r, fx) => fx.gridViewColumnId,
  scope: (env, fx) => [
    { type: 'view', id: fx.viewId },
    { type: 'table', id: fx.tableId },
    { type: 'base', id: env.baseId },
  ],
  assertExists: async (ctx, env, fx) => {
    const cols = await readViewColumns(ctx, env, fx.viewId);
    const row = cols.find((c: any) => c.id === fx.gridViewColumnId);
    expect(row?.width).to.equal('250px');
  },
  assertGone: async (ctx, env, fx) => {
    const cols = await readViewColumns(ctx, env, fx.viewId);
    const row = cols.find((c: any) => c.id === fx.gridViewColumnId);
    expect(row?.width).to.not.equal('250px');
  },
};

interface FormColFx {
  tableId: string;
  formViewId: string;
  formColumnId: string;
}

async function setupFormColumn(ctx: Context, env: TestEnv): Promise<FormColFx> {
  const t = await createTable(ctx, env, `fcTbl_${Date.now()}`);
  const formRes = await internalPost(
    ctx,
    env,
    { operation: 'formViewCreate', tableId: t.id },
    { title: 'Form' },
  );
  expect(formRes.status, `formViewCreate: ${JSON.stringify(formRes.body)}`).to.eq(200);
  const formViewId = formRes.body.id;
  const cols = await readViewColumns(ctx, env, formViewId);
  const titleCol = cols.find((c: any) => c.fk_column_id === t.titleColId);
  expect(titleCol, 'title form-column must exist').to.exist;
  return { tableId: t.id, formViewId, formColumnId: titleCol.id };
}

export const formColumnUpdateSpec: RoundTripSpec<FormColFx> = {
  forward_op: 'formColumnUpdate',
  setup: setupFormColumn,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      {
        operation: 'formColumnUpdate',
        formColumnId: fx.formColumnId,
      },
      { label: 'CustomLabel' },
    ),
  entityId: (_r, fx) => fx.formColumnId,
  scope: (env, fx) => [
    { type: 'view', id: fx.formViewId },
    { type: 'table', id: fx.tableId },
    { type: 'base', id: env.baseId },
  ],
  assertExists: async (ctx, env, fx) => {
    const cols = await readViewColumns(ctx, env, fx.formViewId);
    const row = cols.find((c: any) => c.id === fx.formColumnId);
    expect(row?.label).to.equal('CustomLabel');
  },
  assertGone: async (ctx, env, fx) => {
    const cols = await readViewColumns(ctx, env, fx.formViewId);
    const row = cols.find((c: any) => c.id === fx.formColumnId);
    expect(row?.label).to.not.equal('CustomLabel');
  },
};

async function setupTwoColumnGridView(
  ctx: Context,
  env: TestEnv,
): Promise<{
  tableId: string;
  viewId: string;
  notesViewColumnId: string;
}> {
  const tbl = await createTable(ctx, env, `vTbl_${Date.now()}`, [
    { title: 'Title', type: 'SingleLineText' },
    { title: 'Notes', type: 'SingleLineText' },
  ]);
  const viewId = await createGridView(ctx, env, tbl.id);
  const notesCol = tbl.fields.find((f: any) => f.title === 'Notes');
  expect(notesCol, 'notes column must exist').to.exist;
  const list = await readViewColumns(ctx, env, viewId);
  const notesViewCol = list.find((c: any) => c.fk_column_id === notesCol.id);
  expect(notesViewCol, 'notes view-column must exist').to.exist;
  return { tableId: tbl.id, viewId, notesViewColumnId: notesViewCol.id };
}

interface ShowAllFx {
  tableId: string;
  viewId: string;
  notesViewColumnId: string;
}

export const showAllColumnsSpec: RoundTripSpec<ShowAllFx> = {
  forward_op: 'showAllColumns',
  setup: async (ctx, env) => {
    const fx = await setupTwoColumnGridView(ctx, env);
    // Hide Notes first so showAllColumns has something to do.
    await internalPost(
      ctx,
      env,
      {
        operation: 'viewColumnUpdate',
        viewId: fx.viewId,
        columnId: fx.notesViewColumnId,
      },
      { show: false },
    );
    return fx;
  },
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'showAllColumns', viewId: fx.viewId },
      {},
    ),
  entityId: (_r, fx) => fx.viewId,
  scope: (env, fx) => [
    { type: 'view', id: fx.viewId },
    { type: 'table', id: fx.tableId },
    { type: 'base', id: env.baseId },
  ],
  // Forward returns `true` (not an entity); the contract records the
  // viewId as entity_id via `entry.entity_id: params.viewId`. Forward
  // response carries no entity_id we can read.
  expectNullEntityId: true,
  assertExists: async (ctx, env, fx) => {
    const list = await readViewColumns(ctx, env, fx.viewId);
    const notes = list.find((c: any) => c.id === fx.notesViewColumnId);
    expect(!!notes?.show, '[showAllColumns] notes shown after forward').to.equal(true);
  },
  assertGone: async (ctx, env, fx) => {
    const list = await readViewColumns(ctx, env, fx.viewId);
    const notes = list.find((c: any) => c.id === fx.notesViewColumnId);
    expect(!!notes?.show, '[showAllColumns] notes hidden after undo').to.equal(false);
  },
};

export const hideAllColumnsSpec: RoundTripSpec<ShowAllFx> = {
  forward_op: 'hideAllColumns',
  setup: setupTwoColumnGridView,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'hideAllColumns', viewId: fx.viewId },
      {},
    ),
  entityId: (_r, fx) => fx.viewId,
  scope: (env, fx) => [
    { type: 'view', id: fx.viewId },
    { type: 'table', id: fx.tableId },
    { type: 'base', id: env.baseId },
  ],
  expectNullEntityId: true,
  assertExists: async (ctx, env, fx) => {
    const list = await readViewColumns(ctx, env, fx.viewId);
    const notes = list.find((c: any) => c.id === fx.notesViewColumnId);
    expect(!!notes?.show, '[hideAllColumns] notes hidden after forward').to.equal(false);
  },
  assertGone: async (ctx, env, fx) => {
    const list = await readViewColumns(ctx, env, fx.viewId);
    const notes = list.find((c: any) => c.id === fx.notesViewColumnId);
    expect(!!notes?.show, '[hideAllColumns] notes shown after undo').to.equal(true);
  },
};

export const viewColumnSpecs: RoundTripSpec<any>[] = [
  viewColumnUpdateSpec,
  gridColumnUpdateSpec,
  formColumnUpdateSpec,
  showAllColumnsSpec,
  hideAllColumnsSpec,
];
