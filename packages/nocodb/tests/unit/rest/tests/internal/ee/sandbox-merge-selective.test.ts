import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import { Base, Model, Sandbox, SandboxChangelog } from '~/models';
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
  selectedChangelogIds?: string[],
) {
  const res = await internalPost(
    context,
    workspaceId,
    sandboxBaseId,
    { operation: 'sandboxMerge' },
    selectedChangelogIds ? { selectedChangelogIds } : {},
  );
  expect(res.status, `sandboxMerge: ${JSON.stringify(res.body)}`).to.eq(200);
  await QueueService.queue.onIdle();
  return res.body;
}

// ── Changelog query helpers ──────────────────────────────────────

function getCommandName(entry: SandboxChangelog): string | undefined {
  const meta =
    typeof entry.meta === 'string' ? JSON.parse(entry.meta) : entry.meta;
  return meta?.command?.name as string | undefined;
}

async function findEntryByCommand(
  sandboxBaseId: string,
  command: string,
  predicate?: (e: SandboxChangelog) => boolean,
): Promise<SandboxChangelog> {
  const all = await SandboxChangelog.listByBaseId(sandboxBaseId);
  const match = all.find(
    (e) =>
      getCommandName(e) === command && (predicate ? predicate(e) : true),
  );
  expect(match, `changelog entry for ${command}`).to.exist;
  return match!;
}

// ── Tests ────────────────────────────────────────────────────────

export function sandboxMergeSelectiveTests() {
  describe('Sandbox - Merge cherry-pick / selective', () => {
    let context: Context;
    let workspaceId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;
    });

    it('4.1: column-only selection auto-includes parent table', async () => {
      const master = await createV3Base(context, `cp1_${Date.now()}`);
      const masterCtx = { workspace_id: workspaceId, base_id: master.id };
      const sandboxBaseId = await manualSandboxSetup(
        context,
        workspaceId,
        master.id,
      );

      // Sandbox creates table + column.
      const tCreate = await v3Post(
        context,
        `/api/v3/meta/bases/${sandboxBaseId}/tables`,
        {
          title: 'CP1_Table',
          fields: [{ title: 'Title', type: 'SingleLineText' }],
        },
      );
      expect(tCreate.status).to.eq(200);
      const tableId = tCreate.body.id;

      const cAdd = await v3Post(
        context,
        `/api/v3/meta/bases/${sandboxBaseId}/tables/${tableId}/fields`,
        { title: 'Extra', type: 'SingleLineText' },
      );
      expect(cAdd.status).to.eq(200);
      const extraColId = cAdd.body.id;

      // Select only the columnAdd entry; expansion should pull the table.
      const colEntry = await findEntryByCommand(
        sandboxBaseId,
        'columnAdd',
        (e) => e.entity_id === extraColId,
      );

      await runSandboxMerge(context, workspaceId, sandboxBaseId, [colEntry.id]);

      // Both ended up on master.
      const masterTable = await Model.get(masterCtx, tableId);
      expect(masterTable, 'master table after column-only cherry-pick').to.exist;

      const masterCols = await masterTable!.getColumns(masterCtx);
      const masterCol = masterCols.find((c: any) => c.id === extraColId);
      expect(masterCol, 'master column after cherry-pick').to.exist;
    });

    it('4.2: sort on master-resident view does NOT pull in unrelated sandbox creates', async () => {
      const master = await createV3Base(context, `cp2_${Date.now()}`);
      const masterCtx = { workspace_id: workspaceId, base_id: master.id };

      // Master-resident table + view.
      const tCreate = await v3Post(
        context,
        `/api/v3/meta/bases/${master.id}/tables`,
        {
          title: 'CP2_Master',
          fields: [{ title: 'Title', type: 'SingleLineText' }],
        },
      );
      expect(tCreate.status).to.eq(200);
      const masterTableId = tCreate.body.id;
      const masterTitleColId = tCreate.body.fields.find(
        (f: any) => f.title === 'Title',
      ).id;

      const vRes = await internalPost(
        context,
        workspaceId,
        master.id,
        { operation: 'gridViewCreate', tableId: masterTableId },
        { title: 'CP2_View' },
      );
      expect(vRes.status).to.eq(200);
      const masterViewId = vRes.body.id;

      // Real sandbox spawn — inherits master entities with same IDs.
      const { sandbox_base_id: sandboxBaseId } = await realSandboxCreate(
        context,
        workspaceId,
        master.id,
        'CP2Sandbox',
      );

      // Sandbox creates a sort on the master-resident view.
      const sortRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'sortCreate', viewId: masterViewId },
        { fk_column_id: masterTitleColId, direction: 'asc' },
      );
      expect(sortRes.status).to.eq(200);
      const sortId = sortRes.body.id;

      // Sandbox also creates an unrelated table — should stay pending.
      const unrelated = await v3Post(
        context,
        `/api/v3/meta/bases/${sandboxBaseId}/tables`,
        {
          title: 'CP2_Unrelated',
          fields: [{ title: 'Title', type: 'SingleLineText' }],
        },
      );
      expect(unrelated.status).to.eq(200);
      const unrelatedTableId = unrelated.body.id;

      const sortEntry = await findEntryByCommand(
        sandboxBaseId,
        'sortCreate',
        (e) => e.entity_id === sortId,
      );

      await runSandboxMerge(context, workspaceId, sandboxBaseId, [sortEntry.id]);

      // Sort merged onto master.
      const sandboxCtx = { workspace_id: workspaceId, base_id: sandboxBaseId };
      const Sort = (await import('~/models')).Sort;
      const masterSort = await Sort.get(masterCtx, sortId);
      expect(masterSort, 'master sort after cherry-pick').to.exist;

      // Unrelated sandbox table stayed sandbox-only.
      const unrelatedOnMaster = await Model.get(masterCtx, unrelatedTableId);
      expect(
        unrelatedOnMaster,
        'unrelated sandbox-created table should NOT be on master',
      ).to.not.exist;

      const unrelatedOnSandbox = await Model.get(sandboxCtx, unrelatedTableId);
      expect(
        unrelatedOnSandbox,
        'unrelated table should still exist on sandbox',
      ).to.exist;

      // Changelog: unrelated tableCreate is still pending.
      const pending = await SandboxChangelog.listByBaseId(sandboxBaseId, {
        excludeMerged: true,
      });
      const pendingNames = pending.map(getCommandName);
      expect(
        pendingNames,
        'unrelated tableV3Create still pending after selective merge',
      ).to.include('tableV3Create');
    });

    it('4.3: filter-only selection auto-includes parent view AND table transitively', async () => {
      const master = await createV3Base(context, `cp3_${Date.now()}`);
      const masterCtx = { workspace_id: workspaceId, base_id: master.id };
      const sandboxBaseId = await manualSandboxSetup(
        context,
        workspaceId,
        master.id,
      );

      // Sandbox: table + grid view + filter.
      const tCreate = await v3Post(
        context,
        `/api/v3/meta/bases/${sandboxBaseId}/tables`,
        {
          title: 'CP3_Table',
          fields: [{ title: 'Title', type: 'SingleLineText' }],
        },
      );
      expect(tCreate.status).to.eq(200);
      const tableId = tCreate.body.id;
      const titleColId = tCreate.body.fields.find(
        (f: any) => f.title === 'Title',
      ).id;

      const vRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'gridViewCreate', tableId },
        { title: 'CP3_View' },
      );
      expect(vRes.status).to.eq(200);
      const viewId = vRes.body.id;

      const fRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'filterCreate', viewId },
        {
          fk_column_id: titleColId,
          comparison_op: 'eq',
          value: 'foo',
          logical_op: 'and',
        },
      );
      expect(fRes.status).to.eq(200);
      const filterId = fRes.body.id;

      const filterEntry = await findEntryByCommand(
        sandboxBaseId,
        'filterCreate',
        (e) => e.entity_id === filterId,
      );

      await runSandboxMerge(context, workspaceId, sandboxBaseId, [
        filterEntry.id,
      ]);

      // All three (table, view, filter) should land on master via dep expansion.
      const masterTable = await Model.get(masterCtx, tableId);
      expect(masterTable, 'master table after filter cherry-pick').to.exist;

      const { View, Filter } = await import('~/models');
      const masterView = await View.get(masterCtx, viewId);
      expect(masterView, 'master view after filter cherry-pick').to.exist;

      const masterFilter = await Filter.get(masterCtx, filterId);
      expect(masterFilter, 'master filter after cherry-pick').to.exist;
    });

    it('4.4: re-merging the same selection is idempotent (no errors, no duplicates)', async () => {
      const master = await createV3Base(context, `cp4_${Date.now()}`);
      const masterCtx = { workspace_id: workspaceId, base_id: master.id };
      const sandboxBaseId = await manualSandboxSetup(
        context,
        workspaceId,
        master.id,
      );

      // Single sandbox-created table.
      const tCreate = await v3Post(
        context,
        `/api/v3/meta/bases/${sandboxBaseId}/tables`,
        {
          title: 'CP4_Table',
          fields: [{ title: 'Title', type: 'SingleLineText' }],
        },
      );
      expect(tCreate.status).to.eq(200);
      const tableId = tCreate.body.id;

      const tEntry = await findEntryByCommand(
        sandboxBaseId,
        'tableV3Create',
        (e) => e.entity_id === tableId,
      );

      // First merge.
      await runSandboxMerge(context, workspaceId, sandboxBaseId, [tEntry.id]);

      const masterAfterFirst = await Model.get(masterCtx, tableId);
      expect(masterAfterFirst, 'master table after first merge').to.exist;

      // Second merge with the same selection — no-op (entries are now applied).
      await runSandboxMerge(context, workspaceId, sandboxBaseId, [tEntry.id]);

      // Master still has the single table — no duplicate, no errors.
      const masterAfterSecond = await Model.get(masterCtx, tableId);
      expect(masterAfterSecond, 'master table after idempotent second merge').to
        .exist;
      expect(masterAfterSecond!.title).to.eq('CP4_Table');

      // Confirm the entry is now in 'applied' state — second pass was a no-op.
      const entriesAfter = await SandboxChangelog.listByBaseId(sandboxBaseId, {
        excludeMerged: true,
      });
      expect(
        entriesAfter,
        'no pending entries after applied selection re-merge',
      ).to.have.lengthOf(0);
    });
  });
}
