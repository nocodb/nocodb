import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { ViewTypes, WidgetTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { createTable } from '../../../../factory/table';
import { createProject } from '../../../../factory/base';
import { createView } from '../../../../factory/view';
import { View } from '~/models';
import { Dashboard, Widget, Workflow, Script, Extension } from '~/models';

type Context = Awaited<ReturnType<typeof init>>;

// ── API Helpers ──────────────────────────────────────────────────

async function internalGet(
  context: Context,
  workspaceId: string,
  baseId: string,
  query: Record<string, string>,
) {
  return request(context.app)
    .get(`/api/v2/internal/${workspaceId}/${baseId}`)
    .query(query)
    .set('xc-token', context.xc_token);
}

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

// ── Trash Helpers ────────────────────────────────────────────────

async function listTrash(
  context: Context,
  workspaceId: string,
  baseId: string,
  query: Record<string, string> = {},
) {
  return internalGet(context, workspaceId, baseId, {
    operation: 'baseTrashList',
    ...query,
  });
}

async function restoreTrash(
  context: Context,
  workspaceId: string,
  baseId: string,
  trashId: string,
) {
  return internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'baseTrashRestore' },
    { trashId },
  );
}

async function permanentDeleteTrash(
  context: Context,
  workspaceId: string,
  baseId: string,
  trashId: string,
) {
  return internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'baseTrashPermanentDelete' },
    { trashId },
  );
}

async function emptyTrash(
  context: Context,
  workspaceId: string,
  baseId: string,
) {
  return internalPost(context, workspaceId, baseId, {
    operation: 'baseTrashEmpty',
  });
}

// ── Entity Create/Delete Helpers ─────────────────────────────────

async function createDashboardViaApi(
  context: Context,
  workspaceId: string,
  baseId: string,
  title: string,
) {
  const res = await internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'dashboardCreate' },
    { title },
  );
  expect(res.status).to.eq(200);
  return res.body;
}

async function deleteDashboardViaApi(
  context: Context,
  workspaceId: string,
  baseId: string,
  dashboardId: string,
) {
  return internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'dashboardDelete' },
    { dashboardId },
  );
}

async function createWidgetViaApi(
  context: Context,
  workspaceId: string,
  baseId: string,
  dashboardId: string,
  title: string,
) {
  const res = await internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'widgetCreate' },
    { title, fk_dashboard_id: dashboardId, type: WidgetTypes.TEXT },
  );
  expect(res.status).to.eq(200);
  return res.body;
}

async function deleteWidgetViaApi(
  context: Context,
  workspaceId: string,
  baseId: string,
  widgetId: string,
) {
  return internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'widgetDelete' },
    { widgetId },
  );
}

async function createWorkflowViaApi(
  context: Context,
  workspaceId: string,
  baseId: string,
  title: string,
) {
  const res = await internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'workflowCreate' },
    { title },
  );
  expect(res.status).to.eq(200);
  return res.body;
}

async function deleteWorkflowViaApi(
  context: Context,
  workspaceId: string,
  baseId: string,
  workflowId: string,
) {
  return internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'workflowDelete' },
    { workflowId },
  );
}

async function createScriptViaApi(
  context: Context,
  workspaceId: string,
  baseId: string,
  title: string,
) {
  const res = await internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'createScript' },
    { title },
  );
  expect(res.status).to.eq(200);
  return res.body;
}

async function deleteScriptViaApi(
  context: Context,
  workspaceId: string,
  baseId: string,
  scriptId: string,
) {
  return internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'deleteScript' },
    { id: scriptId },
  );
}

async function createExtensionViaApi(
  context: Context,
  workspaceId: string,
  baseId: string,
  title: string,
) {
  const res = await internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'extensionCreate' },
    { title, extension_id: 'test-extension', base_id: baseId },
  );
  expect(res.status).to.eq(200);
  return res.body;
}

async function deleteExtensionViaApi(
  context: Context,
  workspaceId: string,
  baseId: string,
  extensionId: string,
) {
  return internalPost(context, workspaceId, baseId, {
    operation: 'extensionDelete',
    extensionId,
  });
}

async function deleteViewViaApi(
  context: Context,
  workspaceId: string,
  baseId: string,
  viewId: string,
) {
  return internalPost(context, workspaceId, baseId, {
    operation: 'viewDelete',
    viewId,
  });
}

// ── Find trash entry helper ──────────────────────────────────────

function findTrashEntry(list: any[], resourceId: string) {
  return list.find((t: any) => t.resource_id === resourceId);
}

// ── Tests ────────────────────────────────────────────────────────

export function baseTrashTests() {
  describe('Internal API - Base Trash', () => {
    let context: Context;
    let base: any;
    let ctx: { workspace_id: string; base_id: string };
    let workspaceId: string;
    let baseId: string;

    beforeEach(async () => {
      context = await init();
      base = await createProject(context);
      workspaceId = base.fk_workspace_id;
      baseId = base.id;
      ctx = { workspace_id: workspaceId, base_id: baseId };
    });

    // ── View ───────────────────────────────────────────────────

    describe('View trash & restore', () => {
      it('should hide view from get/list after trash, show after restore', async () => {
        const table = await createTable(context, base);
        const view = await createView(context, {
          title: 'TrashView',
          table,
          type: ViewTypes.GRID,
        });

        // Trash
        const delRes = await deleteViewViaApi(
          context,
          workspaceId,
          baseId,
          view.id,
        );
        expect(delRes.status).to.eq(200);

        // get returns null
        const v = await View.get(ctx, view.id);
        expect(v).to.be.null;

        // list excludes it
        const viewsAfter = await View.list(ctx, table.id);
        expect(viewsAfter.find((vw) => vw.id === view.id)).to.be.undefined;

        // Trash entry exists
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, view.id);
        expect(entry).to.not.be.undefined;
        expect(entry.resource_type).to.eq('view');
        expect(entry.name).to.eq('TrashView');

        // Restore
        const restoreRes = await restoreTrash(
          context,
          workspaceId,
          baseId,
          entry.id,
        );
        expect(restoreRes.status).to.eq(200);

        // get returns it again
        const vRestored = await View.get(ctx, view.id);
        expect(vRestored).to.not.be.null;

        // list includes it again
        const viewsRestored = await View.list(ctx, table.id);
        expect(
          viewsRestored.find((vw) => vw.id === view.id),
        ).to.not.be.undefined;
      });

      it('should record name and parent linkage on the view trash entry', async () => {
        const table = await createTable(context, base);
        const view = await createView(context, {
          title: 'MetaView',
          table,
          type: ViewTypes.GRID,
        });

        await deleteViewViaApi(context, workspaceId, baseId, view.id);

        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, view.id);
        expect(entry).to.not.be.undefined;
        expect(entry.resource_type).to.eq('view');
        expect(entry.name).to.eq('MetaView');
        expect(entry.parent_type).to.eq('table');
        expect(entry.parent_id).to.eq(table.id);
      });
    });

    // ── Extension ──────────────────────────────────────────────

    describe('Extension trash & restore', () => {
      it('should hide extension from get/list after trash, show after restore', async () => {
        const extension = await createExtensionViaApi(
          context,
          workspaceId,
          baseId,
          'TrashExtension',
        );

        // Trash
        const delRes = await deleteExtensionViaApi(
          context,
          workspaceId,
          baseId,
          extension.id,
        );
        expect(delRes.status).to.eq(200);

        // get returns null
        const e = await Extension.get(ctx, extension.id);
        expect(e).to.be.null;

        // list excludes it
        const extensions = await Extension.list(ctx, baseId);
        expect(extensions.find((ex) => ex.id === extension.id)).to.be
          .undefined;

        // Trash entry exists
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, extension.id);
        expect(entry).to.not.be.undefined;
        expect(entry.resource_type).to.eq('extension');

        // Restore
        const restoreRes = await restoreTrash(
          context,
          workspaceId,
          baseId,
          entry.id,
        );
        expect(restoreRes.status).to.eq(200);

        // get returns it again
        const eRestored = await Extension.get(ctx, extension.id);
        expect(eRestored).to.not.be.null;

        // list includes it again
        const extensionsRestored = await Extension.list(ctx, baseId);
        expect(
          extensionsRestored.find((ex) => ex.id === extension.id),
        ).to.not.be.undefined;
      });
    });

    // ── Dashboard ─────────────────────────────────────────────

    describe('Dashboard trash & restore', () => {
      it('should hide dashboard from get/list after trash, show after restore', async () => {
        const dashboard = await createDashboardViaApi(
          context,
          workspaceId,
          baseId,
          'TrashDashboard',
        );

        // Trash
        const delRes = await deleteDashboardViaApi(
          context,
          workspaceId,
          baseId,
          dashboard.id,
        );
        expect(delRes.status).to.eq(200);

        // get returns null
        const d = await Dashboard.get(ctx, dashboard.id);
        expect(d).to.be.null;

        // list excludes it
        const dashboards = await Dashboard.list(ctx, baseId);
        expect(dashboards.find((db) => db.id === dashboard.id)).to.be
          .undefined;

        // Trash entry exists
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, dashboard.id);
        expect(entry).to.not.be.undefined;
        expect(entry.resource_type).to.eq('dashboard');

        // Restore
        const restoreRes = await restoreTrash(
          context,
          workspaceId,
          baseId,
          entry.id,
        );
        expect(restoreRes.status).to.eq(200);

        // get returns it again
        const dRestored = await Dashboard.get(ctx, dashboard.id);
        expect(dRestored).to.not.be.null;

        // list includes it again
        const dashboardsRestored = await Dashboard.list(ctx, baseId);
        expect(
          dashboardsRestored.find((db) => db.id === dashboard.id),
        ).to.not.be.undefined;
      });
    });

    // ── Widget ─────────────────────────────────────────────────

    describe('Widget trash & restore', () => {
      it('should hide widget from get/list after trash, show after restore', async () => {
        const dashboard = await createDashboardViaApi(
          context,
          workspaceId,
          baseId,
          'WidgetHost',
        );
        const widget = await createWidgetViaApi(
          context,
          workspaceId,
          baseId,
          dashboard.id,
          'TrashWidget',
        );

        // Trash
        const delRes = await deleteWidgetViaApi(
          context,
          workspaceId,
          baseId,
          widget.id,
        );
        expect(delRes.status).to.eq(200);

        // get returns null
        const w = await Widget.get(ctx, widget.id);
        expect(w).to.be.null;

        // list excludes it
        const widgets = await Widget.list(ctx, dashboard.id);
        expect(widgets.find((wg) => wg.id === widget.id)).to.be.undefined;

        // Trash entry exists with parent info
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, widget.id);
        expect(entry).to.not.be.undefined;
        expect(entry.resource_type).to.eq('widget');
        expect(entry.parent_type).to.eq('dashboard');
        expect(entry.parent_id).to.eq(dashboard.id);

        // Restore
        const restoreRes = await restoreTrash(
          context,
          workspaceId,
          baseId,
          entry.id,
        );
        expect(restoreRes.status).to.eq(200);

        // get returns it again
        const wRestored = await Widget.get(ctx, widget.id);
        expect(wRestored).to.not.be.null;

        // list includes it again
        const widgetsRestored = await Widget.list(ctx, dashboard.id);
        expect(
          widgetsRestored.find((wg) => wg.id === widget.id),
        ).to.not.be.undefined;
      });

      it('should mark widget as not restorable when parent dashboard is trashed', async () => {
        const dashboard = await createDashboardViaApi(
          context,
          workspaceId,
          baseId,
          'ParentDash',
        );
        const widget = await createWidgetViaApi(
          context,
          workspaceId,
          baseId,
          dashboard.id,
          'ChildWidget',
        );

        // Trash widget first, then dashboard
        await deleteWidgetViaApi(context, workspaceId, baseId, widget.id);
        await deleteDashboardViaApi(
          context,
          workspaceId,
          baseId,
          dashboard.id,
        );

        const trashRes = await listTrash(context, workspaceId, baseId);
        const widgetEntry = findTrashEntry(trashRes.body.list, widget.id);
        const dashEntry = findTrashEntry(trashRes.body.list, dashboard.id);

        expect(dashEntry.is_restorable).to.eq(true);
        expect(widgetEntry.is_restorable).to.eq(false);
      });

      it('should fail to restore widget when parent dashboard is trashed', async () => {
        const dashboard = await createDashboardViaApi(
          context,
          workspaceId,
          baseId,
          'TrashedParent',
        );
        const widget = await createWidgetViaApi(
          context,
          workspaceId,
          baseId,
          dashboard.id,
          'OrphanWidget',
        );

        await deleteWidgetViaApi(context, workspaceId, baseId, widget.id);
        await deleteDashboardViaApi(
          context,
          workspaceId,
          baseId,
          dashboard.id,
        );

        const trashRes = await listTrash(context, workspaceId, baseId);
        const widgetEntry = findTrashEntry(trashRes.body.list, widget.id);

        const restoreRes = await restoreTrash(
          context,
          workspaceId,
          baseId,
          widgetEntry.id,
        );
        expect(restoreRes.status).to.be.gte(400);
      });
    });

    // ── Workflow ────────────────────────────────────────────────

    describe('Workflow trash & restore', () => {
      it('should hide workflow from get/list after trash, show after restore', async () => {
        const workflow = await createWorkflowViaApi(
          context,
          workspaceId,
          baseId,
          'TrashWorkflow',
        );

        // Trash
        const delRes = await deleteWorkflowViaApi(
          context,
          workspaceId,
          baseId,
          workflow.id,
        );
        expect(delRes.status).to.eq(200);

        // get returns null
        const w = await Workflow.get(ctx, workflow.id);
        expect(w).to.be.null;

        // list excludes it
        const workflows = await Workflow.list(ctx, baseId);
        expect(workflows.find((wf) => wf.id === workflow.id)).to.be.undefined;

        // Trash entry exists
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, workflow.id);
        expect(entry).to.not.be.undefined;
        expect(entry.resource_type).to.eq('workflow');

        // Restore
        const restoreRes = await restoreTrash(
          context,
          workspaceId,
          baseId,
          entry.id,
        );
        expect(restoreRes.status).to.eq(200);

        // get returns it again
        const wRestored = await Workflow.get(ctx, workflow.id);
        expect(wRestored).to.not.be.null;

        // list includes it again
        const workflowsRestored = await Workflow.list(ctx, baseId);
        expect(
          workflowsRestored.find((wf) => wf.id === workflow.id),
        ).to.not.be.undefined;
      });
    });

    // ── Script ─────────────────────────────────────────────────

    describe('Script trash & restore', () => {
      it('should hide script from get/list after trash, show after restore', async () => {
        const script = await createScriptViaApi(
          context,
          workspaceId,
          baseId,
          'TrashScript',
        );

        // Trash
        const delRes = await deleteScriptViaApi(
          context,
          workspaceId,
          baseId,
          script.id,
        );
        expect(delRes.status).to.eq(200);

        // get returns null
        const s = await Script.get(ctx, script.id);
        expect(s).to.be.null;

        // list excludes it
        const scripts = await Script.list(ctx, baseId);
        expect(scripts.find((sc) => sc.id === script.id)).to.be.undefined;

        // Trash entry exists
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, script.id);
        expect(entry).to.not.be.undefined;
        expect(entry.resource_type).to.eq('script');

        // Restore
        const restoreRes = await restoreTrash(
          context,
          workspaceId,
          baseId,
          entry.id,
        );
        expect(restoreRes.status).to.eq(200);

        // get returns it again
        const sRestored = await Script.get(ctx, script.id);
        expect(sRestored).to.not.be.null;

        // list includes it again
        const scriptsRestored = await Script.list(ctx, baseId);
        expect(
          scriptsRestored.find((sc) => sc.id === script.id),
        ).to.not.be.undefined;
      });
    });

    // ── Restore with name collision ────────────────────────────

    describe('Restore with name collision', () => {
      it('should auto-rename dashboard on restore if name already taken', async () => {
        const dash1 = await createDashboardViaApi(
          context,
          workspaceId,
          baseId,
          'SameName',
        );

        // Trash it
        await deleteDashboardViaApi(context, workspaceId, baseId, dash1.id);

        // Create another with the same name
        await createDashboardViaApi(
          context,
          workspaceId,
          baseId,
          'SameName',
        );

        // Restore the first — should auto-rename
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, dash1.id);

        const restoreRes = await restoreTrash(
          context,
          workspaceId,
          baseId,
          entry.id,
        );
        expect(restoreRes.status).to.eq(200);

        const restored = await Dashboard.get(ctx, dash1.id);
        expect(restored).to.not.be.null;
        // Title should have been changed to avoid collision
        expect(restored.title).to.not.eq('SameName');
        expect(restored.title).to.include('SameName');
      });
    });

    // ── Permanent Delete ───────────────────────────────────────

    describe('Permanent delete', () => {
      it('should permanently delete a trashed script', async () => {
        const script = await createScriptViaApi(
          context,
          workspaceId,
          baseId,
          'PermDeleteScript',
        );

        await deleteScriptViaApi(context, workspaceId, baseId, script.id);

        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, script.id);

        const delRes = await permanentDeleteTrash(
          context,
          workspaceId,
          baseId,
          entry.id,
        );
        expect(delRes.status).to.eq(200);

        // Completely gone — even with includeDeleted
        const s = await Script.get(ctx, script.id, true);
        expect(s).to.not.be.ok;

        // Trash entry gone
        const trashRes2 = await listTrash(context, workspaceId, baseId);
        expect(findTrashEntry(trashRes2.body.list, script.id)).to.be.undefined;
      });

      it('should clean up child widget trash entries on dashboard permanent delete', async () => {
        const dashboard = await createDashboardViaApi(
          context,
          workspaceId,
          baseId,
          'ParentPermDel',
        );
        const widget = await createWidgetViaApi(
          context,
          workspaceId,
          baseId,
          dashboard.id,
          'ChildPermDel',
        );

        // Trash both
        await deleteWidgetViaApi(context, workspaceId, baseId, widget.id);
        await deleteDashboardViaApi(
          context,
          workspaceId,
          baseId,
          dashboard.id,
        );

        const trashRes = await listTrash(context, workspaceId, baseId);
        const dashEntry = findTrashEntry(trashRes.body.list, dashboard.id);

        // Permanent delete the dashboard
        const delRes = await permanentDeleteTrash(
          context,
          workspaceId,
          baseId,
          dashEntry.id,
        );
        expect(delRes.status).to.eq(200);

        // Both trash entries should be gone
        const trashRes2 = await listTrash(context, workspaceId, baseId);
        expect(findTrashEntry(trashRes2.body.list, dashboard.id)).to.be
          .undefined;
        expect(findTrashEntry(trashRes2.body.list, widget.id)).to.be.undefined;
      });
    });

    // ── Empty Trash ────────────────────────────────────────────

    describe('Empty trash', () => {
      it('should permanently delete all trash entries', async () => {
        const dash = await createDashboardViaApi(
          context,
          workspaceId,
          baseId,
          'EmptyMe1',
        );
        const ext = await createExtensionViaApi(
          context,
          workspaceId,
          baseId,
          'EmptyMe2',
        );

        await deleteDashboardViaApi(context, workspaceId, baseId, dash.id);
        await deleteExtensionViaApi(context, workspaceId, baseId, ext.id);

        const trashBefore = await listTrash(context, workspaceId, baseId);
        expect(trashBefore.body.list.length).to.be.gte(2);

        const emptyRes = await emptyTrash(context, workspaceId, baseId);
        expect(emptyRes.status).to.eq(200);

        const trashAfter = await listTrash(context, workspaceId, baseId);
        expect(trashAfter.body.list.length).to.eq(0);
      });

      it('should succeed on already empty trash', async () => {
        const res = await emptyTrash(context, workspaceId, baseId);
        expect(res.status).to.eq(200);
      });
    });

    // ── Trash List & Pagination ────────────────────────────────

    describe('Trash list & pagination', () => {
      it('should return paginated trash list', async () => {
        for (let i = 0; i < 3; i++) {
          const d = await createDashboardViaApi(
            context,
            workspaceId,
            baseId,
            `Page${i}`,
          );
          await deleteDashboardViaApi(context, workspaceId, baseId, d.id);
        }

        const res1 = await listTrash(context, workspaceId, baseId, {
          limit: '2',
          offset: '0',
        });
        expect(res1.status).to.eq(200);
        expect(res1.body.list.length).to.eq(2);
        expect(res1.body.pageInfo.totalRows).to.eq(3);

        const res2 = await listTrash(context, workspaceId, baseId, {
          limit: '2',
          offset: '2',
        });
        expect(res2.status).to.eq(200);
        expect(res2.body.list.length).to.eq(1);
      });

      it('should filter by resourceType', async () => {
        const dash = await createDashboardViaApi(
          context,
          workspaceId,
          baseId,
          'FilterDash',
        );
        const ext = await createExtensionViaApi(
          context,
          workspaceId,
          baseId,
          'FilterExt',
        );

        await deleteDashboardViaApi(context, workspaceId, baseId, dash.id);
        await deleteExtensionViaApi(context, workspaceId, baseId, ext.id);

        const res = await listTrash(context, workspaceId, baseId, {
          resourceType: 'dashboard',
        });
        expect(res.status).to.eq(200);
        expect(res.body.list.length).to.eq(1);
        expect(res.body.list[0].resource_type).to.eq('dashboard');
      });

      it('should return empty list for base with no trash', async () => {
        const res = await listTrash(context, workspaceId, baseId);
        expect(res.status).to.eq(200);
        expect(res.body.list).to.be.an('array');
        expect(res.body.list.length).to.eq(0);
      });
    });

    // ── Error Handling ─────────────────────────────────────────

    describe('Error handling', () => {
      it('should return error when restoring non-existent trash', async () => {
        const res = await restoreTrash(
          context,
          workspaceId,
          baseId,
          'nonexistent_id',
        );
        expect(res.status).to.be.gte(400);
      });

      it('should return error when permanently deleting non-existent trash', async () => {
        const res = await permanentDeleteTrash(
          context,
          workspaceId,
          baseId,
          'nonexistent_id',
        );
        expect(res.status).to.be.gte(400);
      });

      it('should prevent double-trashing', async () => {
        const dash = await createDashboardViaApi(
          context,
          workspaceId,
          baseId,
          'DoubleTrash',
        );

        await deleteDashboardViaApi(context, workspaceId, baseId, dash.id);

        // Second trash attempt should fail (already deleted / not found)
        const res2 = await deleteDashboardViaApi(
          context,
          workspaceId,
          baseId,
          dash.id,
        );
        expect(res2.status).to.be.gte(400);
      });
    });

    // ── Round-trip: Dashboard + Widget ──────────────────────────

    describe('Round-trip: trash dashboard + widget, restore in order', () => {
      it('should restore dashboard first, then widget', async () => {
        const dashboard = await createDashboardViaApi(
          context,
          workspaceId,
          baseId,
          'RoundTripDash',
        );
        const widget = await createWidgetViaApi(
          context,
          workspaceId,
          baseId,
          dashboard.id,
          'RoundTripWidget',
        );

        // Trash both
        await deleteWidgetViaApi(context, workspaceId, baseId, widget.id);
        await deleteDashboardViaApi(
          context,
          workspaceId,
          baseId,
          dashboard.id,
        );

        const trashRes = await listTrash(context, workspaceId, baseId);
        const dashEntry = findTrashEntry(trashRes.body.list, dashboard.id);
        const widgetEntry = findTrashEntry(trashRes.body.list, widget.id);

        // Restore dashboard first
        const restoreDash = await restoreTrash(
          context,
          workspaceId,
          baseId,
          dashEntry.id,
        );
        expect(restoreDash.status).to.eq(200);

        // Now restore widget
        const restoreWidget = await restoreTrash(
          context,
          workspaceId,
          baseId,
          widgetEntry.id,
        );
        expect(restoreWidget.status).to.eq(200);

        // Both accessible
        const d = await Dashboard.get(ctx, dashboard.id);
        expect(d).to.not.be.null;

        const w = await Widget.get(ctx, widget.id);
        expect(w).to.not.be.null;
      });
    });
  });
}
