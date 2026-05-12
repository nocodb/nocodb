import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { createGridView, internalPost, readViews } from '~test/factory/internal';
import { GridView } from '~/models';
import { setupTable, tableScope, viewExists } from '~test/rest/tests/internal/ee/undo-redo/shared';
import type { TableFx } from '~test/rest/tests/internal/ee/undo-redo/shared';

// ── Per-type Create specs ─────────────────────────────────────────

function makeViewCreateSpec(
  op:
    | 'gridViewCreate'
    | 'formViewCreate'
    | 'galleryViewCreate'
    | 'kanbanViewCreate'
    | 'calendarViewCreate'
    | 'mapViewCreate'
    | 'timelineViewCreate'
    | 'listViewCreate',
  body: (fx: TableFx) => Record<string, any>,
): RoundTripSpec<TableFx> {
  return {
    forward_op: op,
    setup: setupTable,
    forward: (ctx, env, fx) =>
      internalPost(
        ctx,
        env,
        { operation: op, tableId: fx.tableId },
        body(fx)
      ),
    entityId: (r) => r.body.id,
    scope: tableScope,
    assertExists: async (ctx, env, fx, id) => {
      expect(await viewExists(ctx, env, fx.tableId, id)).to.equal(true);
    },
    assertGone: async (ctx, env, fx, id) => {
      expect(await viewExists(ctx, env, fx.tableId, id)).to.equal(false);
    },
  };
}

export const gridViewCreateSpec = makeViewCreateSpec('gridViewCreate', () => ({
  title: 'NewGrid',
}));

export const formViewCreateSpec = makeViewCreateSpec('formViewCreate', () => ({
  title: 'NewForm',
}));

export const galleryViewCreateSpec = makeViewCreateSpec('galleryViewCreate', () => ({
  title: 'NewGallery',
}));

// Kanban / map / timeline column-ref fields (`fk_grp_col_id`,
// `fk_geo_data_col_id`, `fk_from_column_id`) expect specific column types
// (SingleSelect / GeoData / Date) — passing the Title column id would
// pollute the view with a bogus reference. The services accept null
// refs at create; the round-trip just needs create→undo→redo to cycle.
export const kanbanViewCreateSpec = makeViewCreateSpec('kanbanViewCreate', () => ({
  title: 'NewKanban',
}));

export const calendarViewCreateSpec = makeViewCreateSpec(
  'calendarViewCreate',
  () => ({
    title: 'NewCalendar',
    calendar_range: [],
  }),
);

export const mapViewCreateSpec = makeViewCreateSpec('mapViewCreate', () => ({
  title: 'NewMap',
}));

export const timelineViewCreateSpec = makeViewCreateSpec(
  'timelineViewCreate',
  () => ({
    title: 'NewTimeline',
  }),
);

interface ViewFx extends TableFx {
  viewId: string;
  originalTitle: string;
}

async function setupViewForUpdate(ctx: Context, env: TestEnv): Promise<ViewFx> {
  const tbl = await setupTable(ctx, env);
  const viewId = await createGridView(ctx, env, tbl.tableId, 'OriginalTitle');
  return { ...tbl, viewId, originalTitle: 'OriginalTitle' };
}

export const viewUpdateRenameSpec: RoundTripSpec<ViewFx> = {
  forward_op: 'viewUpdate',
  setup: setupViewForUpdate,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'viewUpdate', viewId: fx.viewId },
      { title: 'RenamedTitle' }
    ),
  entityId: (_r, fx) => fx.viewId,
  // Rename-class viewUpdate is BASE-scoped (sidebar field) per dynamicScope rules.
  scope: (env) => [{ type: 'base', id: env.baseId }],
  assertExists: async (ctx, env, fx) => {
    const views = await readViews(ctx, env, fx.tableId);
    const row = views.find((v: any) => v.id === fx.viewId);
    expect(row?.title).to.equal('RenamedTitle');
  },
  assertGone: async (ctx, env, fx) => {
    const views = await readViews(ctx, env, fx.tableId);
    const row = views.find((v: any) => v.id === fx.viewId);
    expect(row?.title).to.equal('OriginalTitle');
  },
};

export const viewDeleteSpec: RoundTripSpec<ViewFx> = {
  forward_op: 'viewDelete',
  forwardIsDelete: true,
  setup: setupViewForUpdate,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'viewDelete', viewId: fx.viewId },
      {}
    ),
  entityId: (_r, fx) => fx.viewId,
  scope: tableScope,
  assertExists: async (ctx, env, fx) => {
    expect(await viewExists(ctx, env, fx.tableId, fx.viewId)).to.equal(true);
  },
  assertGone: async (ctx, env, fx) => {
    expect(await viewExists(ctx, env, fx.tableId, fx.viewId)).to.equal(false);
  },
};

// ── Per-type view update (gridViewUpdate) ─────────────────────────

interface PerTypeViewFx {
  tableId: string;
  viewId: string;
  originalRowHeight: number;
}

async function setupGridForUpdate(
  ctx: Context,
  env: TestEnv,
): Promise<PerTypeViewFx> {
  const t = await setupTable(ctx, env, `gTbl_${Date.now()}`);
  const viewId = await createGridView(ctx, env, t.tableId);
  await internalPost(
    ctx,
    env,
    { operation: 'gridViewUpdate', viewId },
    { row_height: 2 },
  );
  return {
    tableId: t.tableId,
    viewId,
    originalRowHeight: 2,
  };
}

export const gridViewUpdateSpec: RoundTripSpec<PerTypeViewFx> = {
  forward_op: 'gridViewUpdate',
  setup: setupGridForUpdate,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'gridViewUpdate', viewId: fx.viewId },
      { row_height: 3 }
    ),
  entityId: (_r, fx) => fx.viewId,
  scope: (env, fx) => [
    { type: 'view', id: fx.viewId },
    { type: 'table', id: fx.tableId },
    { type: 'base', id: env.baseId },
  ],
  assertExists: async (_ctx, env, fx) => {
    const g = await GridView.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.viewId,
    );
    expect((g as any)?.row_height).to.equal(3);
  },
  assertGone: async (_ctx, env, fx) => {
    const g = await GridView.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.viewId,
    );
    expect((g as any)?.row_height).to.equal(fx.originalRowHeight);
  },
};

export const viewSpecs: RoundTripSpec<any>[] = [
  gridViewCreateSpec,
  formViewCreateSpec,
  galleryViewCreateSpec,
  kanbanViewCreateSpec,
  calendarViewCreateSpec,
  mapViewCreateSpec,
  timelineViewCreateSpec,
  viewUpdateRenameSpec,
  viewDeleteSpec,
  gridViewUpdateSpec,
];
