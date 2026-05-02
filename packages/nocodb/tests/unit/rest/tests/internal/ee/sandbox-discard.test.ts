import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import {
  Base,
  BaseVariable,
  Model,
  Sandbox,
  SandboxChangelog,
} from '~/models';
import { QueueService } from '~/modules/jobs/fallback/fallback-queue.service';

type Context = Awaited<ReturnType<typeof init>>;

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
  return res.body as { sandbox_base_id: string; id: string };
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

async function runDiscard(
  context: Context,
  workspaceId: string,
  sandboxBaseId: string,
) {
  const res = await internalPost(
    context,
    workspaceId,
    sandboxBaseId,
    { operation: 'sandboxDiscard' },
    {},
  );
  expect(res.status, `sandboxDiscard: ${JSON.stringify(res.body)}`).to.eq(200);
  await QueueService.queue.onIdle();
  return res.body;
}

export function sandboxDiscardTests() {
  describe('Sandbox - Discard', () => {
    let context: Context;
    let workspaceId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;
    });

    it('5.1 + 5.2: discard reverts sandbox-only changes and clears changelog', async () => {
      const master = await createV3Base(context, `dsc1_${Date.now()}`);
      const masterCtx = { workspace_id: workspaceId, base_id: master.id };

      // Master-resident table that should remain intact on master throughout.
      const masterTable = await v3Post(
        context,
        `/api/v3/meta/bases/${master.id}/tables`,
        {
          title: 'Persistent',
          fields: [{ title: 'Title', type: 'SingleLineText' }],
        },
      );
      expect(masterTable.status).to.eq(200);
      const persistentTableId = masterTable.body.id;

      const { sandbox_base_id: sandboxBaseId } = await realSandboxCreate(
        context,
        workspaceId,
        master.id,
        'DiscardSandbox',
      );
      const sandboxCtx = { workspace_id: workspaceId, base_id: sandboxBaseId };

      // Sandbox-only addition that discard should revert.
      const sbxTable = await v3Post(
        context,
        `/api/v3/meta/bases/${sandboxBaseId}/tables`,
        {
          title: 'SandboxOnly',
          fields: [{ title: 'Title', type: 'SingleLineText' }],
        },
      );
      expect(sbxTable.status).to.eq(200);
      const sandboxOnlyTableId = sbxTable.body.id;

      // Sanity: sandbox state has diverged from master.
      const beforeDiscard = await SandboxChangelog.listByBaseId(sandboxBaseId);
      expect(beforeDiscard.length, 'changelog populated before discard').to.be
        .greaterThan(0);

      // Discard.
      await runDiscard(context, workspaceId, sandboxBaseId);

      // 5.1 — sandbox-only table is gone; inherited table still present.
      const sandboxOnlyOnSandbox = await Model.get(
        sandboxCtx,
        sandboxOnlyTableId,
      );
      expect(
        sandboxOnlyOnSandbox,
        'sandbox-only table removed post-discard',
      ).to.not.exist;

      const persistentOnSandbox = await Model.get(sandboxCtx, persistentTableId);
      expect(
        persistentOnSandbox,
        'inherited table still present on sandbox post-discard',
      ).to.exist;

      // Master untouched.
      const persistentOnMaster = await Model.get(masterCtx, persistentTableId);
      expect(
        persistentOnMaster,
        'master persistent table untouched by discard',
      ).to.exist;
      const sandboxOnlyOnMaster = await Model.get(masterCtx, sandboxOnlyTableId);
      expect(
        sandboxOnlyOnMaster,
        'master never received the sandbox-only table',
      ).to.not.exist;

      // 5.2 changelog cleared.
      const afterDiscard = await SandboxChangelog.listByBaseId(sandboxBaseId);
      expect(
        afterDiscard.length,
        'changelog should be empty post-discard',
      ).to.eq(0);
    });

    it('5.3: sandbox base variables survive discard (intentional asymmetry)', async () => {
      const master = await createV3Base(context, `dsc2_${Date.now()}`);
      const sandboxBaseId = await manualSandboxSetup(
        context,
        workspaceId,
        master.id,
      );
      const sandboxCtx = { workspace_id: workspaceId, base_id: sandboxBaseId };

      const bvRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'baseVariableCreate' },
        {
          key: 'KEEP_ME',
          value: 'sandbox-only',
          type: 'text',
          inheritance: 'editable',
        },
      );
      expect(
        bvRes.status,
        `baseVariableCreate: ${JSON.stringify(bvRes.body)}`,
      ).to.eq(200);
      const bvId = bvRes.body.id;

      await runDiscard(context, workspaceId, sandboxBaseId);

      const surviving = await BaseVariable.get(sandboxCtx, bvId);
      expect(
        surviving,
        'sandbox base variable should survive discard',
      ).to.exist;
      expect(surviving!.value).to.eq('sandbox-only');
    });

    it('5.4: a fresh sandbox can be spawned after discard', async () => {
      const master = await createV3Base(context, `dsc3_${Date.now()}`);

      // First cycle: spawn + discard.
      const first = await realSandboxCreate(
        context,
        workspaceId,
        master.id,
        'CycleOneSandbox',
      );
      await runDiscard(context, workspaceId, first.sandbox_base_id);

      // sandboxDelete tears down the sandbox base + Sandbox row so a new one
      // can be spawned. (Discard alone leaves the sandbox alive but reset.)
      const del = await internalPost(
        context,
        workspaceId,
        first.sandbox_base_id,
        { operation: 'sandboxDelete' },
        {},
      );
      expect(del.status, `sandboxDelete: ${JSON.stringify(del.body)}`).to.eq(
        200,
      );
      await QueueService.queue.onIdle();

      // Second cycle: a new sandbox should be creatable on the same master.
      const second = await realSandboxCreate(
        context,
        workspaceId,
        master.id,
        'CycleTwoSandbox',
      );
      expect(second.sandbox_base_id, 'second sandbox base id').to.be.a(
        'string',
      );
      expect(
        second.sandbox_base_id,
        'second sandbox base distinct from first',
      ).to.not.eq(first.sandbox_base_id);
    });
  });
}
