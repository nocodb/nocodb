import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import {
  Base,
  BaseVariable,
  Dashboard,
  Extension,
  Filter,
  Hook,
  Model,
  Sandbox,
  Script,
  Sort,
  Widget,
  Workflow,
} from '~/models';
import { QueueService } from '~/modules/jobs/fallback/fallback-queue.service';

type Context = Awaited<ReturnType<typeof init>>;

// ── HTTP helpers ─────────────────────────────────────────────────

async function internalPost(
  context: Context,
  workspaceId: string,
  baseId: string,
  query: Record<string, string>,
  body: Record<string, any> = {},
) {
  return request(context.app)
    .post(`/api/v2/internal/${workspaceId}/${baseId}`)
    .query(query)
    .set('xc-token', context.xc_token)
    .send(body);
}

async function v3Post(
  context: Context,
  path: string,
  body: Record<string, any> = {},
) {
  return request(context.app)
    .post(path)
    .set('xc-token', context.xc_token)
    .send(body);
}

async function createV3Base(context: Context, title: string) {
  const res = await request(context.app)
    .post('/api/v1/db/meta/projects/')
    .set('xc-auth', context.token)
    .send({
      title,
      version: 3,
      ...(process.env.EE ? { fk_workspace_id: context.fk_workspace_id } : {}),
    });
  expect(res.status).to.eq(200);
  return res.body;
}

async function manualSandboxSetup(
  context: Context,
  workspaceId: string,
  masterId: string,
) {
  const sandboxBase = await createV3Base(context, `sbx_${Date.now()}`);
  await Base.update(
    { workspace_id: workspaceId, base_id: sandboxBase.id },
    sandboxBase.id,
    { is_sandbox: true } as any,
  );
  await Base.update(
    { workspace_id: workspaceId, base_id: masterId },
    masterId,
    { is_sandbox_production: true } as any,
  );
  await Sandbox.insert(
    { workspace_id: workspaceId, base_id: masterId },
    {
      production_base_id: masterId,
      sandbox_base_id: sandboxBase.id,
      fk_workspace_id: workspaceId,
      created_by: context.user.id,
    },
  );
  return sandboxBase.id;
}

async function realSandboxCreate(
  context: Context,
  workspaceId: string,
  masterId: string,
  title: string,
) {
  const res = await internalPost(
    context,
    workspaceId,
    masterId,
    { operation: 'sandboxCreate' },
    { title },
  );
  expect(res.status, `sandboxCreate: ${JSON.stringify(res.body)}`).to.eq(200);
  await QueueService.queue.onIdle();
  return res.body as { sandbox_base_id: string };
}

async function runSandboxMerge(
  context: Context,
  workspaceId: string,
  sandboxBaseId: string,
) {
  const res = await internalPost(
    context,
    workspaceId,
    sandboxBaseId,
    { operation: 'sandboxMerge' },
    {},
  );
  expect(res.status, `sandboxMerge: ${JSON.stringify(res.body)}`).to.eq(200);
  await QueueService.queue.onIdle();
  return res.body;
}

// ── ID collection ────────────────────────────────────────────────

interface IdSnapshot {
  tables: Set<string>;
  columns: Set<string>;
  systemColumnIdsByTitle: Record<string, string>;
  views: Set<string>;
  defaultViewIdsByTable: Record<string, string>;
  sorts: Set<string>;
  filters: Set<string>;
  hooks: Set<string>;
  extensions: Set<string>;
  dashboards: Set<string>;
  widgets: Set<string>;
  scripts: Set<string>;
  workflows: Set<string>;
  baseVariables: Set<string>;
}

async function collectIds(
  workspaceId: string,
  baseId: string,
): Promise<IdSnapshot> {
  const ctx = { workspace_id: workspaceId, base_id: baseId };

  const tables = await Model.list(ctx, { base_id: baseId });
  const tableIds = new Set(tables.map((t) => t.id));

  const columnIds = new Set<string>();
  const systemColumnIdsByTitle: Record<string, string> = {};
  const viewIds = new Set<string>();
  const defaultViewIdsByTable: Record<string, string> = {};
  const sortIds = new Set<string>();
  const filterIds = new Set<string>();
  const hookIds = new Set<string>();

  for (const t of tables) {
    const cols = await t.getColumns(ctx);
    for (const c of cols) {
      columnIds.add(c.id);
      // system columns are flagged `system: true`; capture by title for
      // explicit cross-base equality on those specific rows.
      if ((c as any).system) {
        systemColumnIdsByTitle[`${t.id}:${c.title}`] = c.id;
      }
    }

    const views = await t.getViews(ctx);
    for (const v of views) {
      viewIds.add(v.id);
      if ((v as any).is_default) {
        defaultViewIdsByTable[t.id] = v.id;
      }

      const sortsForView = await Sort.list(ctx, { viewId: v.id });
      sortsForView?.forEach((s) => sortIds.add(s.id));

      const filtersForView = await Filter.rootFilterList(ctx, { viewId: v.id });
      filtersForView?.forEach((f) => filterIds.add(f.id));
    }

    const hooksForTable = await Hook.list(ctx, { fk_model_id: t.id });
    hooksForTable?.forEach((h) => hookIds.add(h.id));
  }

  const extensions = await Extension.list(ctx, baseId);
  const extensionIds = new Set((extensions as any[]).map((e: any) => e.id));

  const dashboards = await Dashboard.list(ctx, baseId);
  const dashboardIds = new Set((dashboards as any[]).map((d: any) => d.id));

  const widgetIds = new Set<string>();
  for (const d of dashboards as any[]) {
    const widgets = await Widget.list(ctx, d.id);
    (widgets as any[]).forEach((w: any) => widgetIds.add(w.id));
  }

  const scripts = await Script.list(ctx, baseId);
  const scriptIds = new Set((scripts as any[]).map((s: any) => s.id));

  const workflows = await Workflow.list(ctx, baseId);
  const workflowIds = new Set((workflows as any[]).map((w: any) => w.id));

  const baseVariables = await BaseVariable.list(ctx, baseId);
  const baseVarIds = new Set((baseVariables as any[]).map((v: any) => v.id));

  return {
    tables: tableIds,
    columns: columnIds,
    systemColumnIdsByTitle,
    views: viewIds,
    defaultViewIdsByTable,
    sorts: sortIds,
    filters: filterIds,
    hooks: hookIds,
    extensions: extensionIds,
    dashboards: dashboardIds,
    widgets: widgetIds,
    scripts: scriptIds,
    workflows: workflowIds,
    baseVariables: baseVarIds,
  };
}

function expectSetsEqual(
  expected: Set<string>,
  actual: Set<string>,
  label: string,
) {
  const exp = [...expected].sort();
  const act = [...actual].sort();
  expect(act, `${label} (size ${expected.size} vs ${actual.size})`).to.deep.eq(
    exp,
  );
}

function expectMapEqual(
  expected: Record<string, string>,
  actual: Record<string, string>,
  label: string,
) {
  expect(actual, label).to.deep.eq(expected);
}

function expectSnapshotEqual(
  expected: IdSnapshot,
  actual: IdSnapshot,
  direction: string,
) {
  expectSetsEqual(expected.tables, actual.tables, `${direction}: tables`);
  expectSetsEqual(expected.columns, actual.columns, `${direction}: columns`);
  expectMapEqual(
    expected.systemColumnIdsByTitle,
    actual.systemColumnIdsByTitle,
    `${direction}: system columns by title`,
  );
  expectSetsEqual(expected.views, actual.views, `${direction}: views`);
  expectMapEqual(
    expected.defaultViewIdsByTable,
    actual.defaultViewIdsByTable,
    `${direction}: default-view-by-table`,
  );
  expectSetsEqual(expected.sorts, actual.sorts, `${direction}: sorts`);
  expectSetsEqual(expected.filters, actual.filters, `${direction}: filters`);
  expectSetsEqual(expected.hooks, actual.hooks, `${direction}: hooks`);
  expectSetsEqual(
    expected.extensions,
    actual.extensions,
    `${direction}: extensions`,
  );
  expectSetsEqual(
    expected.dashboards,
    actual.dashboards,
    `${direction}: dashboards`,
  );
  expectSetsEqual(expected.widgets, actual.widgets, `${direction}: widgets`);
  expectSetsEqual(expected.scripts, actual.scripts, `${direction}: scripts`);
  expectSetsEqual(
    expected.workflows,
    actual.workflows,
    `${direction}: workflows`,
  );
  expectSetsEqual(
    expected.baseVariables,
    actual.baseVariables,
    `${direction}: base variables`,
  );
}

// ── Seed all entity types on a base ─────────────────────────────
//
// Used by both directions: in direction-1 it seeds master before sandboxCreate;
// in direction-2 it seeds the sandbox after manual setup. Generates one of
// every entity type the sandbox replay layer cares about, so the snapshot
// covers system columns, default views, all view-types, sort, filter, hook,
// extension, dashboard, widget, duplicate-widget, script, workflow, baseVar.

async function seedAllEntities(
  context: Context,
  workspaceId: string,
  baseId: string,
) {
  const tCreate = await v3Post(
    context,
    `/api/v3/meta/bases/${baseId}/tables`,
    {
      title: 'IDP_Table',
      fields: [
        { title: 'Title', type: 'SingleLineText' },
        { title: 'Notes', type: 'SingleLineText' },
        { title: 'EventDate', type: 'Date' },
      ],
    },
  );
  expect(tCreate.status, `tableCreate: ${JSON.stringify(tCreate.body)}`).to.eq(
    200,
  );
  const tableId = tCreate.body.id;
  const titleColId = tCreate.body.fields.find(
    (f: any) => f.title === 'Title',
  ).id;
  const dateColId = tCreate.body.fields.find(
    (f: any) => f.title === 'EventDate',
  ).id;

  // Custom column on top of the seed fields.
  const cAdd = await v3Post(
    context,
    `/api/v3/meta/bases/${baseId}/tables/${tableId}/fields`,
    { title: 'Extra', type: 'SingleLineText' },
  );
  expect(cAdd.status).to.eq(200);

  // One of every view type so view IDs (across grid/form/gallery/kanban/calendar)
  // also enter the snapshot.
  for (const [op, body] of [
    ['gridViewCreate', { title: 'IDP_Grid' }],
    ['formViewCreate', { title: 'IDP_Form' }],
    ['galleryViewCreate', { title: 'IDP_Gallery' }],
    ['kanbanViewCreate', { title: 'IDP_Kanban' }],
    [
      'calendarViewCreate',
      {
        title: 'IDP_Calendar',
        calendar_range: [{ fk_from_column_id: dateColId }],
      },
    ],
  ] as const) {
    const res = await internalPost(
      context,
      workspaceId,
      baseId,
      { operation: op, tableId },
      body,
    );
    expect(res.status, `${op}: ${JSON.stringify(res.body)}`).to.eq(200);
  }

  // The seeded grid view we'll attach sort + filter to.
  const gridId = (
    await internalPost(
      context,
      workspaceId,
      baseId,
      { operation: 'gridViewCreate', tableId },
      { title: 'IDP_Grid_For_Children' },
    )
  ).body.id;

  await internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'sortCreate', viewId: gridId },
    { fk_column_id: titleColId, direction: 'asc' },
  );
  await internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'filterCreate', viewId: gridId },
    {
      fk_column_id: titleColId,
      comparison_op: 'eq',
      value: 'foo',
      logical_op: 'and',
    },
  );

  await internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'hookCreate', tableId },
    {
      title: 'IDP_Hook',
      event: 'after',
      operation: ['insert'],
      version: 'v3',
      notification: { type: 'URL', payload: { url: 'https://example.test/wh' } },
      active: true,
    },
  );

  await internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'extensionCreate' },
    {
      title: 'IDP_Ext',
      extension_id: 'test-extension',
      base_id: baseId,
      kv_store: {},
    },
  );

  const dashRes = await internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'dashboardCreate' },
    { title: 'IDP_Dash' },
  );
  expect(dashRes.status).to.eq(200);
  const dashboardId = dashRes.body.id;

  const widgetRes = await internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'widgetCreate' },
    {
      title: 'IDP_Widget',
      type: 'text',
      fk_dashboard_id: dashboardId,
      position: { x: 0, y: 0, w: 2, h: 2 },
    },
  );
  expect(widgetRes.status).to.eq(200);

  // Duplicate so widgetIds includes the duplicate too. Replay path threads
  // entity_id through `_replayWidgetId` (see dashboards.handlers.ts).
  await internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'widgetDuplicate' },
    { widgetId: widgetRes.body.id },
  );

  await internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'createScript' },
    { title: 'IDP_Script', script: '// noop' },
  );

  await internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'workflowCreate' },
    { title: 'IDP_Workflow' },
  );

  await internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'baseVariableCreate' },
    {
      key: 'IDP_VAR',
      value: 'idp-value',
      type: 'text',
      inheritance: 'editable',
    },
  );
}

// ── Tests ────────────────────────────────────────────────────────

export function sandboxIdPreservationTests() {
  describe('Sandbox - ID preservation', () => {
    let context: Context;
    let workspaceId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;
    });

    it('master → sandbox: sandboxCreate (DuplicateBase) preserves IDs across all entity types', async () => {
      const master = await createV3Base(context, `idp_d1_${Date.now()}`);
      const masterId = master.id;

      // Seed master before sandboxCreate (master is still mutable).
      await seedAllEntities(context, workspaceId, masterId);

      const masterSnapshot = await collectIds(workspaceId, masterId);

      // Sanity: snapshot is non-empty across the major buckets.
      expect(masterSnapshot.tables.size, 'master tables').to.be.greaterThan(0);
      expect(masterSnapshot.columns.size, 'master columns').to.be.greaterThan(0);
      expect(masterSnapshot.views.size, 'master views').to.be.greaterThan(0);
      expect(masterSnapshot.dashboards.size, 'master dashboards').to.eq(1);
      expect(masterSnapshot.widgets.size, 'master widgets').to.eq(2); // one + duplicate

      const { sandbox_base_id: sandboxBaseId } = await realSandboxCreate(
        context,
        workspaceId,
        masterId,
        'IDPSandbox',
      );

      const sandboxSnapshot = await collectIds(workspaceId, sandboxBaseId);

      expectSnapshotEqual(masterSnapshot, sandboxSnapshot, 'master→sandbox');
    });

    it('sandbox → master: merge replay preserves IDs across all entity types', async () => {
      const master = await createV3Base(context, `idp_d2_${Date.now()}`);
      const masterId = master.id;
      const sandboxBaseId = await manualSandboxSetup(
        context,
        workspaceId,
        masterId,
      );

      // Seed sandbox (master starts empty).
      await seedAllEntities(context, workspaceId, sandboxBaseId);

      const sandboxSnapshot = await collectIds(workspaceId, sandboxBaseId);

      // Sanity again.
      expect(sandboxSnapshot.tables.size, 'sandbox tables').to.be.greaterThan(
        0,
      );
      expect(sandboxSnapshot.widgets.size, 'sandbox widgets').to.eq(2);

      await runSandboxMerge(context, workspaceId, sandboxBaseId);

      const masterSnapshot = await collectIds(workspaceId, masterId);

      expectSnapshotEqual(sandboxSnapshot, masterSnapshot, 'sandbox→master');
    });
  });
}
