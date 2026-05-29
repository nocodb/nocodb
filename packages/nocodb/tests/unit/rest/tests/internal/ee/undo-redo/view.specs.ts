import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { isPgData } from '~test/init/db';
import { createGridView, internalPost, readViews } from '~test/factory/internal';
import {
  CalendarView,
  FormView,
  GalleryView,
  GridView,
  KanbanView,
  ListView,
  ListViewLevel,
  MapView,
  TimelineView,
} from '~/models';
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

interface PerTypeMetaFx {
  tableId: string;
  viewId: string;
}

type PerTypeUpdateOp =
  | 'formViewUpdate'
  | 'galleryViewUpdate'
  | 'kanbanViewUpdate'
  | 'mapViewUpdate'
  | 'calendarViewUpdate'
  | 'timelineViewUpdate';

async function readPerTypeMeta(
  env: TestEnv,
  op: PerTypeUpdateOp,
  viewId: string,
): Promise<any> {
  const ctx = {
    workspace_id: env.workspaceId,
    base_id: env.baseId,
  } as any;
  let row: any;
  switch (op) {
    case 'formViewUpdate':
      row = await FormView.get(ctx, viewId);
      break;
    case 'galleryViewUpdate':
      row = await GalleryView.get(ctx, viewId);
      break;
    case 'kanbanViewUpdate':
      row = await KanbanView.get(ctx, viewId);
      break;
    case 'mapViewUpdate':
      row = await MapView.get(ctx, viewId);
      break;
    case 'calendarViewUpdate':
      row = await CalendarView.get(ctx, viewId);
      break;
    case 'timelineViewUpdate':
      row = await TimelineView.get(ctx, viewId);
      break;
  }
  const meta = row?.meta;
  return typeof meta === 'string' ? JSON.parse(meta) : meta;
}

function makeViewUpdateSpec(
  forward_op: PerTypeUpdateOp,
  createOp:
    | 'formViewCreate'
    | 'galleryViewCreate'
    | 'kanbanViewCreate'
    | 'mapViewCreate'
    | 'calendarViewCreate'
    | 'timelineViewCreate',
  createBody: () => Record<string, any> = () => ({ title: 'V' }),
): RoundTripSpec<PerTypeMetaFx> {
  return {
    forward_op,
    setup: async (ctx, env) => {
      const t = await setupTable(ctx, env);
      const res = await internalPost(
        ctx,
        env,
        { operation: createOp, tableId: t.tableId },
        createBody(),
      );
      expect(res.status, `${createOp}: ${JSON.stringify(res.body)}`).to.eq(200);
      return { tableId: t.tableId, viewId: res.body.id };
    },
    forward: (ctx, env, fx) =>
      internalPost(
        ctx,
        env,
        { operation: forward_op, viewId: fx.viewId },
        { meta: { testMarker: 'after' } },
      ),
    entityId: (_r, fx) => fx.viewId,
    scope: (env, fx) => [
      { type: 'view', id: fx.viewId },
      { type: 'table', id: fx.tableId },
      { type: 'base', id: env.baseId },
    ],
    assertExists: async (_ctx, env, fx) => {
      const meta = await readPerTypeMeta(env, forward_op, fx.viewId);
      expect(meta?.testMarker, `[${forward_op}] meta.testMarker`).to.equal(
        'after',
      );
    },
    assertGone: async (_ctx, env, fx) => {
      const meta = await readPerTypeMeta(env, forward_op, fx.viewId);
      expect(
        meta?.testMarker,
        `[${forward_op}] meta.testMarker reverted`,
      ).to.not.equal('after');
    },
  };
}

export const formViewUpdateSpec = makeViewUpdateSpec(
  'formViewUpdate',
  'formViewCreate',
);
export const galleryViewUpdateSpec = makeViewUpdateSpec(
  'galleryViewUpdate',
  'galleryViewCreate',
);
export const kanbanViewUpdateSpec = makeViewUpdateSpec(
  'kanbanViewUpdate',
  'kanbanViewCreate',
);
export const mapViewUpdateSpec = makeViewUpdateSpec(
  'mapViewUpdate',
  'mapViewCreate',
);
export const calendarViewUpdateSpec = makeViewUpdateSpec(
  'calendarViewUpdate',
  'calendarViewCreate',
  () => ({ title: 'V', calendar_range: [] }),
);

export const timelineViewUpdateSpec = makeViewUpdateSpec(
  'timelineViewUpdate',
  'timelineViewCreate',
  () => ({ title: 'V', timeline_range: [] }),
);

interface ListViewFx {
  tableId: string;
  viewId: string;
  originalRowHeight: number;
}

async function setupListView(
  ctx: Context,
  env: TestEnv,
): Promise<ListViewFx> {
  const t = await setupTable(ctx, env, `listTbl_${Date.now()}`);
  const create = await internalPost(
    ctx,
    env,
    { operation: 'listViewCreate', tableId: t.tableId },
    { title: `L_${Date.now()}`, row_height: 1 },
  );
  expect(
    create.status,
    `listViewCreate: ${JSON.stringify(create.body)}`,
  ).to.eq(200);
  return { tableId: t.tableId, viewId: create.body.id, originalRowHeight: 1 };
}

export const listViewUpdateSpec: RoundTripSpec<ListViewFx> = {
  forward_op: 'listViewUpdate',
  // List view is pg-only — listViewCreate returns 400 on mssql/mysql/sqlite.
  skipIf: (ctx) => !isPgData(ctx),
  setup: setupListView,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'listViewUpdate', viewId: fx.viewId },
      { row_height: 3 },
    ),
  entityId: (_r, fx) => fx.viewId,
  scope: (env, fx) => [
    { type: 'view', id: fx.viewId },
    { type: 'table', id: fx.tableId },
    { type: 'base', id: env.baseId },
  ],
  assertExists: async (_ctx, env, fx) => {
    const lv = await ListView.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.viewId,
    );
    expect((lv as any)?.row_height).to.equal(3);
  },
  assertGone: async (_ctx, env, fx) => {
    const lv = await ListView.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.viewId,
    );
    expect((lv as any)?.row_height).to.equal(fx.originalRowHeight);
  },
};

interface ListLevelsFx extends ListViewFx {
  levelId: string;
}

async function setupListViewWithLevel(
  ctx: Context,
  env: TestEnv,
): Promise<ListLevelsFx> {
  const fx = await setupListView(ctx, env);
  // listViewCreate auto-seeds a level 0 for the root table; fetch its id.
  const levels = await ListViewLevel.list(
    { workspace_id: env.workspaceId, base_id: env.baseId } as any,
    fx.viewId,
  );
  expect(levels.length, 'list view has a root level').to.be.greaterThan(0);
  return { ...fx, levelId: levels[0].id };
}

export const listViewLevelsRestoreSpec: RoundTripSpec<ListLevelsFx> = {
  forward_op: 'listViewUpdate',
  // Distinct from `listViewUpdateSpec` — disambiguates in mocha output.
  label: 'listViewLevelsRestore (via listViewUpdate{levels})',
  // List view is pg-only — listViewCreate returns 400 on mssql/mysql/sqlite.
  skipIf: (ctx) => !isPgData(ctx),
  setup: setupListViewWithLevel,
  // Match the existing level by `fk_model_id` and flip wrap_headers.
  // `bulkInsertOrUpdate` matches by model id, so this updates in place
  // rather than inserting a new level.
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'listViewUpdate', viewId: fx.viewId },
      {
        levels: [
          {
            level: 0,
            fk_model_id: fx.tableId,
            wrap_headers: true,
          },
        ],
      },
    ),
  entityId: (_r, fx) => fx.viewId,
  scope: (env, fx) => [
    { type: 'view', id: fx.viewId },
    { type: 'table', id: fx.tableId },
    { type: 'base', id: env.baseId },
  ],
  // Tree-shaped restore — single round-trip is enough to exercise the
  // inverse op; doubling adds churn without coverage gain.
  skipDoubleCycle: true,
  assertExists: async (_ctx, env, fx) => {
    const levels = await ListViewLevel.list(
      { workspace_id: env.workspaceId, base_id: env.baseId } as any,
      fx.viewId,
    );
    const lvl = levels.find((l: any) => l.fk_model_id === fx.tableId);
    expect(!!(lvl as any)?.wrap_headers, '[listViewLevelsRestore] wrap_headers flipped').to.equal(true);
  },
  assertGone: async (_ctx, env, fx) => {
    const levels = await ListViewLevel.list(
      { workspace_id: env.workspaceId, base_id: env.baseId } as any,
      fx.viewId,
    );
    const lvl = levels.find((l: any) => l.fk_model_id === fx.tableId);
    expect(!!(lvl as any)?.wrap_headers, '[listViewLevelsRestore] wrap_headers restored').to.equal(false);
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
  formViewUpdateSpec,
  galleryViewUpdateSpec,
  kanbanViewUpdateSpec,
  mapViewUpdateSpec,
  calendarViewUpdateSpec,
  timelineViewUpdateSpec,
  listViewUpdateSpec,
  listViewLevelsRestoreSpec,
];
