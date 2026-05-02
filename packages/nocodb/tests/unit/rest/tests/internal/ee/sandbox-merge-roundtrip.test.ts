import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import {
  Base,
  BaseVariable,
  CalendarView,
  Dashboard,
  Extension,
  Filter,
  Hook,
  Model,
  Sandbox,
  Script,
  Sort,
  View,
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

async function v3Patch(
  context: Context,
  path: string,
  body: Record<string, any> = {},
) {
  return request(context.app)
    .patch(path)
    .set('xc-token', context.xc_token)
    .send(body);
}

// ── Sandbox lifecycle ────────────────────────────────────────────

async function createV3Base(context: Context, title: string) {
  const res = await request(context.app)
    .post('/api/v1/db/meta/projects/')
    .set('xc-auth', context.token)
    .send({
      title,
      version: 3,
      ...(process.env.EE ? { fk_workspace_id: context.fk_workspace_id } : {}),
    });
  expect(res.status, `createV3Base ${title}: ${JSON.stringify(res.body)}`).to.eq(
    200,
  );
  return res.body;
}

async function setupSandbox(context: Context, workspaceId: string) {
  const ts = Date.now();
  const master = await createV3Base(context, `master_${ts}`);
  const sandboxBase = await createV3Base(context, `sbx_${ts}`);

  await Base.update(
    { workspace_id: workspaceId, base_id: sandboxBase.id },
    sandboxBase.id,
    { is_sandbox: true } as any,
  );

  await Base.update(
    { workspace_id: workspaceId, base_id: master.id },
    master.id,
    { is_sandbox_production: true } as any,
  );

  await Sandbox.insert(
    { workspace_id: workspaceId, base_id: master.id },
    {
      production_base_id: master.id,
      sandbox_base_id: sandboxBase.id,
      fk_workspace_id: workspaceId,
      created_by: context.user.id,
    },
  );

  return { masterId: master.id, sandboxBaseId: sandboxBase.id };
}

// Run sandboxMerge and wait for the fallback queue to drain.
// The merge job runs through the in-process PQueue; onIdle resolves once
// all queued processors have completed.
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

// ── Tests ────────────────────────────────────────────────────────

export function sandboxMergeRoundtripTests() {
  describe('Sandbox - Merge round-trip + ID preservation', () => {
    let context: Context;
    let workspaceId: string;
    let masterId: string;
    let sandboxBaseId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;
      const setup = await setupSandbox(context, workspaceId);
      masterId = setup.masterId;
      sandboxBaseId = setup.sandboxBaseId;
    });

    it('replays create-then-merge for every domain with stable IDs', async () => {
      const masterCtx = { workspace_id: workspaceId, base_id: masterId };

      // ── 1. tableCreate (V3 REST) — gives back grid view, columns ──
      const tCreate = await v3Post(
        context,
        `/api/v3/meta/bases/${sandboxBaseId}/tables`,
        {
          title: 'RT_Table',
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

      // ── 2. columnAdd (V3) ──
      const cAdd = await v3Post(
        context,
        `/api/v3/meta/bases/${sandboxBaseId}/tables/${tableId}/fields`,
        { title: 'Extra', type: 'SingleLineText' },
      );
      expect(cAdd.status, `columnAdd: ${JSON.stringify(cAdd.body)}`).to.eq(200);
      const extraColId = cAdd.body.id;

      // ── 3. View creates: form, gallery, kanban (no fk_grp_col_id), calendar ──
      const formRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'formViewCreate', tableId },
        { title: 'RT_Form' },
      );
      expect(
        formRes.status,
        `formViewCreate: ${JSON.stringify(formRes.body)}`,
      ).to.eq(200);
      const formViewId = formRes.body.id;

      const galleryRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'galleryViewCreate', tableId },
        { title: 'RT_Gallery' },
      );
      expect(
        galleryRes.status,
        `galleryViewCreate: ${JSON.stringify(galleryRes.body)}`,
      ).to.eq(200);
      const galleryViewId = galleryRes.body.id;

      const kanbanRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'kanbanViewCreate', tableId },
        { title: 'RT_Kanban' }, // 2.2: no fk_grp_col_id (regression)
      );
      expect(
        kanbanRes.status,
        `kanbanViewCreate: ${JSON.stringify(kanbanRes.body)}`,
      ).to.eq(200);
      const kanbanViewId = kanbanRes.body.id;

      const calendarRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'calendarViewCreate', tableId },
        {
          title: 'RT_Calendar',
          calendar_range: [{ fk_from_column_id: dateColId }], // 2.2: with date range
        },
      );
      expect(
        calendarRes.status,
        `calendarViewCreate: ${JSON.stringify(calendarRes.body)}`,
      ).to.eq(200);
      const calendarViewId = calendarRes.body.id;

      const gridRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'gridViewCreate', tableId },
        { title: 'RT_Grid' },
      );
      expect(
        gridRes.status,
        `gridViewCreate: ${JSON.stringify(gridRes.body)}`,
      ).to.eq(200);
      const gridViewId = gridRes.body.id;

      // ── 4. sortCreate ──
      const sortRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'sortCreate', viewId: gridViewId },
        { fk_column_id: titleColId, direction: 'asc' },
      );
      expect(
        sortRes.status,
        `sortCreate: ${JSON.stringify(sortRes.body)}`,
      ).to.eq(200);
      const sortId = sortRes.body.id;

      // ── 5. filterCreate ──
      const filterRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'filterCreate', viewId: gridViewId },
        {
          fk_column_id: titleColId,
          comparison_op: 'eq',
          value: 'foo',
          logical_op: 'and',
        },
      );
      expect(
        filterRes.status,
        `filterCreate: ${JSON.stringify(filterRes.body)}`,
      ).to.eq(200);
      const filterId = filterRes.body.id;

      // ── 6. hookCreate ──
      const hookRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'hookCreate', tableId },
        {
          title: 'RT_Hook',
          event: 'after',
          operation: ['insert'],
          version: 'v3',
          notification: { type: 'URL', payload: { url: 'https://example.test/wh' } },
          active: true,
        },
      );
      expect(
        hookRes.status,
        `hookCreate: ${JSON.stringify(hookRes.body)}`,
      ).to.eq(200);
      const hookId = hookRes.body.id;

      // ── 7. extensionCreate ──
      const extRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'extensionCreate' },
        {
          title: 'RT_Ext',
          extension_id: 'test-extension',
          base_id: sandboxBaseId,
          kv_store: {},
        },
      );
      expect(
        extRes.status,
        `extensionCreate: ${JSON.stringify(extRes.body)}`,
      ).to.eq(200);
      const extensionId = extRes.body.id;

      // ── 8. dashboardCreate + widgetCreate + duplicateWidget ──
      const dashRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'dashboardCreate' },
        { title: 'RT_Dash' },
      );
      expect(
        dashRes.status,
        `dashboardCreate: ${JSON.stringify(dashRes.body)}`,
      ).to.eq(200);
      const dashboardId = dashRes.body.id;

      const widgetRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'widgetCreate' },
        {
          title: 'RT_Widget',
          type: 'text',
          fk_dashboard_id: dashboardId,
          position: { x: 0, y: 0, w: 2, h: 2 },
        },
      );
      expect(
        widgetRes.status,
        `widgetCreate: ${JSON.stringify(widgetRes.body)}`,
      ).to.eq(200);
      const widgetId = widgetRes.body.id;

      const dupRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'widgetDuplicate' },
        { widgetId },
      );
      expect(
        dupRes.status,
        `duplicateWidget: ${JSON.stringify(dupRes.body)}`,
      ).to.eq(200);
      const duplicatedWidgetId = dupRes.body.id;

      // ── 9. createScript ──
      const scriptRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'createScript' },
        { title: 'RT_Script', script: '// noop' },
      );
      expect(
        scriptRes.status,
        `createScript: ${JSON.stringify(scriptRes.body)}`,
      ).to.eq(200);
      const scriptId = scriptRes.body.id;

      // ── 10. workflowCreate ──
      const wfRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'workflowCreate' },
        { title: 'RT_Workflow' },
      );
      expect(
        wfRes.status,
        `workflowCreate: ${JSON.stringify(wfRes.body)}`,
      ).to.eq(200);
      const workflowId = wfRes.body.id;

      // ── 11. baseVariableCreate ──
      const bvRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'baseVariableCreate' },
        {
          key: 'RT_KEY',
          value: 'rt-value',
          type: 'text',
          inheritance: 'editable',
        },
      );
      expect(
        bvRes.status,
        `baseVariableCreate: ${JSON.stringify(bvRes.body)}`,
      ).to.eq(200);
      const baseVarId = bvRes.body.id;

      // ── Merge ──
      await runSandboxMerge(context, workspaceId, sandboxBaseId);

      // ── 2.1: every entity exists on master with the same ID ──
      const masterTable = await Model.get(masterCtx, tableId);
      expect(masterTable, `master table ${tableId}`).to.exist;
      expect(masterTable!.title).to.eq('RT_Table');

      const masterCols = await masterTable!.getColumns(masterCtx);
      const masterExtraCol = masterCols.find((c: any) => c.id === extraColId);
      expect(masterExtraCol, `master column ${extraColId}`).to.exist;
      expect(masterExtraCol!.title).to.eq('Extra');

      for (const [vid, vTitle] of [
        [formViewId, 'RT_Form'],
        [galleryViewId, 'RT_Gallery'],
        [kanbanViewId, 'RT_Kanban'],
        [calendarViewId, 'RT_Calendar'],
        [gridViewId, 'RT_Grid'],
      ] as const) {
        const v = await View.get(masterCtx, vid);
        expect(v, `master view ${vTitle} (${vid})`).to.exist;
        expect(v!.title).to.eq(vTitle);
      }

      // 2.2 calendar with date range — verify range survived round-trip
      const calOnMaster = await CalendarView.get(masterCtx, calendarViewId);
      expect(calOnMaster, `master calendar ${calendarViewId}`).to.exist;
      expect(
        calOnMaster!.calendar_range?.length,
        'calendar_range count',
      ).to.be.greaterThan(0);

      const masterSort = await Sort.get(masterCtx, sortId);
      expect(masterSort, `master sort ${sortId}`).to.exist;

      const masterFilter = await Filter.get(masterCtx, filterId);
      expect(masterFilter, `master filter ${filterId}`).to.exist;

      const masterHook = await Hook.get(masterCtx, hookId);
      expect(masterHook, `master hook ${hookId}`).to.exist;
      expect(masterHook!.title).to.eq('RT_Hook');

      const masterExt = await Extension.get(masterCtx, extensionId);
      expect(masterExt, `master extension ${extensionId}`).to.exist;

      const masterDash = await Dashboard.get(masterCtx, dashboardId);
      expect(masterDash, `master dashboard ${dashboardId}`).to.exist;

      const masterWidget = await Widget.get(masterCtx, widgetId);
      expect(masterWidget, `master widget ${widgetId}`).to.exist;

      // 2.2 widget via duplicateWidget — duplicated widget exists on master too
      const masterDupWidget = await Widget.get(masterCtx, duplicatedWidgetId);
      expect(
        masterDupWidget,
        `master duplicated widget ${duplicatedWidgetId}`,
      ).to.exist;

      const masterScript = await Script.get(masterCtx, scriptId);
      expect(masterScript, `master script ${scriptId}`).to.exist;

      const masterWf = await Workflow.get(masterCtx, workflowId);
      expect(masterWf, `master workflow ${workflowId}`).to.exist;

      const masterBV = await BaseVariable.get(masterCtx, baseVarId);
      expect(masterBV, `master base variable ${baseVarId}`).to.exist;
      expect(masterBV!.key).to.eq('RT_KEY');
      expect(masterBV!.value).to.eq('rt-value');
    });

    it('replays update-then-merge: rename propagates to master', async () => {
      const masterCtx = { workspace_id: workspaceId, base_id: masterId };

      // Create + merge a table so master has it.
      const tCreate = await v3Post(
        context,
        `/api/v3/meta/bases/${sandboxBaseId}/tables`,
        {
          title: 'UpdateTable',
          fields: [{ title: 'Title', type: 'SingleLineText' }],
        },
      );
      expect(tCreate.status).to.eq(200);
      const tableId = tCreate.body.id;
      const titleColId = tCreate.body.fields.find(
        (f: any) => f.title === 'Title',
      ).id;

      // baseVariable as a value-update target (it has no rename caveats).
      const bvRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'baseVariableCreate' },
        {
          key: 'UPD_KEY',
          value: 'v1',
          type: 'text',
          inheritance: 'editable',
        },
      );
      expect(bvRes.status).to.eq(200);
      const baseVarId = bvRes.body.id;

      // 2.4 — two updates in single sandbox should land final value only.
      const cu1 = await v3Patch(
        context,
        `/api/v3/meta/bases/${sandboxBaseId}/tables/${tableId}/fields/${titleColId}`,
        { title: 'TitleR1' },
      );
      expect(cu1.status, `columnUpdate#1: ${JSON.stringify(cu1.body)}`).to.eq(200);
      const cu2 = await v3Patch(
        context,
        `/api/v3/meta/bases/${sandboxBaseId}/tables/${tableId}/fields/${titleColId}`,
        { title: 'TitleR2' },
      );
      expect(cu2.status, `columnUpdate#2: ${JSON.stringify(cu2.body)}`).to.eq(200);

      // baseVariableUpdate value change.
      const bvUpd = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'baseVariableUpdate', variableId: baseVarId },
        { value: 'v2' },
      );
      expect(
        bvUpd.status,
        `baseVariableUpdate: ${JSON.stringify(bvUpd.body)}`,
      ).to.eq(200);

      await runSandboxMerge(context, workspaceId, sandboxBaseId);

      // 2.3: column rename reached master.
      const masterTable = await Model.get(masterCtx, tableId);
      expect(masterTable, `master table ${tableId}`).to.exist;
      const masterCols = await masterTable!.getColumns(masterCtx);
      const renamedCol = masterCols.find((c: any) => c.id === titleColId);
      expect(renamedCol, `renamed column ${titleColId}`).to.exist;
      // 2.4 — final value, not the intermediate.
      expect(renamedCol!.title).to.eq('TitleR2');

      const masterBV = await BaseVariable.get(masterCtx, baseVarId);
      expect(masterBV, `master base variable ${baseVarId}`).to.exist;
      expect(masterBV!.value).to.eq('v2');
    });
  });
}
