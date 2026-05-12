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

export const viewColumnSpecs: RoundTripSpec<any>[] = [viewColumnUpdateSpec];
