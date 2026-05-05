import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import { Base, Model, Sandbox, SandboxChangelog } from '~/models';
import BaseTrash from '~/ee/models/BaseTrash';
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

async function v3Delete(context: Context, path: string) {
  return request(context.app)
    .delete(path)
    .set('xc-token', context.xc_token);
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
  expect(res.status, `createV3Base ${title}: ${JSON.stringify(res.body)}`).to.eq(
    200,
  );
  return res.body;
}

// ── Sandbox lifecycle ────────────────────────────────────────────

// Real sandbox flow — fires sandboxCreate (which spawns DuplicateBase) and
// drains the in-process queue. Master entities are duplicated to the sandbox
// with their IDs preserved, which the case-(a) tests below depend on.
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
  return res.body as { sandbox_base_id: string; id: string; job_id?: string };
}

// Manual sandbox wiring for tests where we don't need master state inheritance.
async function manualSandboxSetup(
  context: Context,
  workspaceId: string,
  masterId: string,
) {
  const ts = Date.now();
  const sandboxBase = await createV3Base(context, `sbx_${ts}`);

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

export function sandboxMergeDeleteTests() {
  describe('Sandbox - Merge delete handling', () => {
    let context: Context;
    let workspaceId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;
    });

    // Case (a): master-resident entity deleted via sandbox.
    // After merge, master+sandbox both show the entity in trash (mirror).
    describe('case (a): delete master-resident entities through sandbox', () => {
      it('3.1: tableDelete on inherited table → master trash mirrors sandbox', async () => {
        const master = await createV3Base(context, `case_a_table_${Date.now()}`);
        const masterId = master.id;
        const masterCtx = { workspace_id: workspaceId, base_id: masterId };

        // Master-resident table.
        const tCreate = await v3Post(
          context,
          `/api/v3/meta/bases/${masterId}/tables`,
          {
            title: 'CaseA_Table',
            fields: [{ title: 'Title', type: 'SingleLineText' }],
          },
        );
        expect(
          tCreate.status,
          `master tableCreate: ${JSON.stringify(tCreate.body)}`,
        ).to.eq(200);
        const tableId = tCreate.body.id;

        // Real sandbox spawn — DuplicateBase copies the table to the sandbox
        // with the same id.
        const { sandbox_base_id: sandboxBaseId } = await realSandboxCreate(
          context,
          workspaceId,
          masterId,
          'CaseASandbox',
        );
        const sandboxCtx = { workspace_id: workspaceId, base_id: sandboxBaseId };

        // Sanity: sandbox inherited the same table id.
        const inheritedOnSandbox = await Model.get(sandboxCtx, tableId);
        expect(
          inheritedOnSandbox,
          `sandbox should inherit table ${tableId}`,
        ).to.exist;

        // Sandbox deletes the inherited table.
        const sbxDelete = await v3Delete(
          context,
          `/api/v3/meta/bases/${sandboxBaseId}/tables/${tableId}`,
        );
        expect(
          sbxDelete.status,
          `sandbox tableDelete: ${JSON.stringify(sbxDelete.body)}`,
        ).to.eq(200);

        // Sandbox trash should contain the table now.
        const sbxTrash = await BaseTrash.getByResourceId(
          sandboxCtx,
          'table',
          tableId,
        );
        expect(sbxTrash, 'sandbox trash entry').to.exist;

        // Master still alive at this point (no merge yet).
        const masterBeforeMerge = await Model.get(masterCtx, tableId);
        expect(masterBeforeMerge, 'master should be untouched pre-merge').to
          .exist;

        // Merge replays tableDelete on master.
        await runSandboxMerge(context, workspaceId, sandboxBaseId);

        // Master trash now mirrors sandbox.
        const masterTrash = await BaseTrash.getByResourceId(
          masterCtx,
          'table',
          tableId,
        );
        expect(masterTrash, 'master trash entry after merge').to.exist;
      });

      it('3.2: columnDelete on inherited column → master trash mirrors sandbox', async () => {
        const master = await createV3Base(context, `case_a_col_${Date.now()}`);
        const masterId = master.id;
        const masterCtx = { workspace_id: workspaceId, base_id: masterId };

        const tCreate = await v3Post(
          context,
          `/api/v3/meta/bases/${masterId}/tables`,
          {
            title: 'CaseA_ColTable',
            fields: [
              { title: 'Title', type: 'SingleLineText' },
              { title: 'Notes', type: 'SingleLineText' },
            ],
          },
        );
        expect(tCreate.status).to.eq(200);
        const tableId = tCreate.body.id;
        const notesColId = tCreate.body.fields.find(
          (f: any) => f.title === 'Notes',
        ).id;

        const { sandbox_base_id: sandboxBaseId } = await realSandboxCreate(
          context,
          workspaceId,
          masterId,
          'CaseAColSandbox',
        );
        const sandboxCtx = { workspace_id: workspaceId, base_id: sandboxBaseId };

        const sbxDelete = await v3Delete(
          context,
          `/api/v3/meta/bases/${sandboxBaseId}/tables/${tableId}/fields/${notesColId}`,
        );
        expect(
          sbxDelete.status,
          `sandbox columnDelete: ${JSON.stringify(sbxDelete.body)}`,
        ).to.eq(200);

        const sbxTrash = await BaseTrash.getByResourceId(
          sandboxCtx,
          'field',
          notesColId,
        );
        expect(sbxTrash, 'sandbox trash entry for column').to.exist;

        await runSandboxMerge(context, workspaceId, sandboxBaseId);

        const masterTrash = await BaseTrash.getByResourceId(
          masterCtx,
          'field',
          notesColId,
        );
        expect(masterTrash, 'master trash entry for column after merge').to
          .exist;
      });

      it('3.3: viewDelete on inherited view → master trash mirrors sandbox', async () => {
        const master = await createV3Base(context, `case_a_view_${Date.now()}`);
        const masterId = master.id;
        const masterCtx = { workspace_id: workspaceId, base_id: masterId };

        const tCreate = await v3Post(
          context,
          `/api/v3/meta/bases/${masterId}/tables`,
          {
            title: 'CaseA_ViewTable',
            fields: [{ title: 'Title', type: 'SingleLineText' }],
          },
        );
        expect(tCreate.status).to.eq(200);
        const tableId = tCreate.body.id;

        // Add a custom grid view (the default view can't be deleted).
        const vRes = await internalPost(
          context,
          workspaceId,
          masterId,
          { operation: 'gridViewCreate', tableId },
          { title: 'CaseA_View' },
        );
        expect(
          vRes.status,
          `master gridViewCreate: ${JSON.stringify(vRes.body)}`,
        ).to.eq(200);
        const viewId = vRes.body.id;

        const { sandbox_base_id: sandboxBaseId } = await realSandboxCreate(
          context,
          workspaceId,
          masterId,
          'CaseAViewSandbox',
        );
        const sandboxCtx = { workspace_id: workspaceId, base_id: sandboxBaseId };

        const sbxViewDelete = await internalPost(
          context,
          workspaceId,
          sandboxBaseId,
          { operation: 'viewDelete', viewId },
          {},
        );
        expect(
          sbxViewDelete.status,
          `sandbox viewDelete: ${JSON.stringify(sbxViewDelete.body)}`,
        ).to.eq(200);

        const sbxTrash = await BaseTrash.getByResourceId(
          sandboxCtx,
          'view',
          viewId,
        );
        expect(sbxTrash, 'sandbox trash entry for view').to.exist;

        await runSandboxMerge(context, workspaceId, sandboxBaseId);

        const masterTrash = await BaseTrash.getByResourceId(
          masterCtx,
          'view',
          viewId,
        );
        expect(masterTrash, 'master trash entry for view after merge').to.exist;
      });
    });

    // Case (c): sandbox creates and deletes within the same sandbox.
    // Both ops replay on master — master ends with the entity in trash too,
    // which the trash TTL eventually purges. Plan.md decision: replay
    // through trash (no skipTrash) keeps master/sandbox symmetric.
    describe('case (c): sandbox-only entity created and deleted before merge', () => {
      it('3.5: tableCreate+tableDelete in same sandbox → master ends with table in trash', async () => {
        const master = await createV3Base(context, `case_c_${Date.now()}`);
        const masterId = master.id;
        const masterCtx = { workspace_id: workspaceId, base_id: masterId };

        const sandboxBaseId = await manualSandboxSetup(
          context,
          workspaceId,
          masterId,
        );
        const sandboxCtx = { workspace_id: workspaceId, base_id: sandboxBaseId };

        // Sandbox-only entity: create + delete before merge.
        const tCreate = await v3Post(
          context,
          `/api/v3/meta/bases/${sandboxBaseId}/tables`,
          {
            title: 'CaseC_Ephemeral',
            fields: [{ title: 'Title', type: 'SingleLineText' }],
          },
        );
        expect(
          tCreate.status,
          `sandbox tableCreate: ${JSON.stringify(tCreate.body)}`,
        ).to.eq(200);
        const tableId = tCreate.body.id;

        const tDelete = await v3Delete(
          context,
          `/api/v3/meta/bases/${sandboxBaseId}/tables/${tableId}`,
        );
        expect(
          tDelete.status,
          `sandbox tableDelete: ${JSON.stringify(tDelete.body)}`,
        ).to.eq(200);

        // Sandbox: trash now holds the table.
        const sbxTrash = await BaseTrash.getByResourceId(
          sandboxCtx,
          'table',
          tableId,
        );
        expect(sbxTrash, 'sandbox trash for ephemeral table').to.exist;

        // Confirm both ops are in the changelog before merge.
        const changelog = await SandboxChangelog.listByBaseId(sandboxBaseId);
        const cmdNames = changelog.map((e) => {
          const m = typeof e.meta === 'string' ? JSON.parse(e.meta) : e.meta;
          return m?.command?.name as string | undefined;
        });
        expect(cmdNames, 'changelog ops').to.include.members([
          'tableV3Create',
          'tableDelete',
        ]);

        await runSandboxMerge(context, workspaceId, sandboxBaseId);

        // Master replayed both ops — table was created on master then trashed.
        // Trash row exists; the live table is gone (Model.get returns falsy).
        const masterLive = await Model.get(masterCtx, tableId);
        expect(masterLive, 'master should have no live ephemeral table').to.not
          .exist;

        const masterTrash = await BaseTrash.getByResourceId(
          masterCtx,
          'table',
          tableId,
        );
        expect(
          masterTrash,
          'master trash entry after replay-create-then-delete',
        ).to.exist;
      });
    });

    // Case (b): sandbox creates the entity, merges, then deletes & merges again.
    // The first merge promotes the table to master; the second merge replays
    // the delete onto master so the table lands in master's trash.
    describe('case (b): sandbox-created entity deleted in a follow-up sandbox cycle', () => {
      it('3.4: create+merge+delete+merge → master trash has the table', async () => {
        const master = await createV3Base(context, `case_b_${Date.now()}`);
        const masterId = master.id;
        const masterCtx = { workspace_id: workspaceId, base_id: masterId };

        const sandboxBaseId = await manualSandboxSetup(
          context,
          workspaceId,
          masterId,
        );

        // Cycle 1: create + merge.
        const tCreate = await v3Post(
          context,
          `/api/v3/meta/bases/${sandboxBaseId}/tables`,
          {
            title: 'CaseB_Table',
            fields: [{ title: 'Title', type: 'SingleLineText' }],
          },
        );
        expect(tCreate.status).to.eq(200);
        const tableId = tCreate.body.id;

        await runSandboxMerge(context, workspaceId, sandboxBaseId);

        const masterAfterFirstMerge = await Model.get(masterCtx, tableId);
        expect(
          masterAfterFirstMerge,
          'master should have table after first merge',
        ).to.exist;

        // Cycle 2: delete + second merge.
        const tDelete = await v3Delete(
          context,
          `/api/v3/meta/bases/${sandboxBaseId}/tables/${tableId}`,
        );
        expect(
          tDelete.status,
          `sandbox tableDelete: ${JSON.stringify(tDelete.body)}`,
        ).to.eq(200);

        await runSandboxMerge(context, workspaceId, sandboxBaseId);

        const masterTrash = await BaseTrash.getByResourceId(
          masterCtx,
          'table',
          tableId,
        );
        expect(
          masterTrash,
          'master trash entry after second-merge delete',
        ).to.exist;
      });
    });
  });
}
