import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import { createV3Base } from '~test/factory/base';
import { Base, Sandbox } from '~/models';
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

async function v3Delete(context: Context, path: string) {
  return request(context.app)
    .delete(path)
    .set('xc-token', context.xc_token);
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

export function sandboxMasterGuardTests() {
  describe('Sandbox - Master guard', () => {
    let context: Context;
    let workspaceId: string;
    let masterId: string;
    let sandboxBaseId: string;
    let seedTableId: string;
    let seedColId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      const master = await createV3Base(context, `mg_${Date.now()}`);
      masterId = master.id;

      // Master starts with one table so we have something to attempt
      // Update/Delete/columnAdd against in 6.1.
      const tCreate = await v3Post(
        context,
        `/api/v3/meta/bases/${masterId}/tables`,
        {
          title: 'GuardedTable',
          fields: [{ title: 'Title', type: 'SingleLineText' }],
        },
      );
      expect(tCreate.status).to.eq(200);
      seedTableId = tCreate.body.id;
      seedColId = tCreate.body.fields.find(
        (f: any) => f.title === 'Title',
      ).id;

      sandboxBaseId = await manualSandboxSetup(context, workspaceId, masterId);
    });

    it('6.1: master tableCreate/Update/Delete/columnAdd are blocked while sandbox is active', async () => {
      // tableCreate on master — blocked
      const masterTableCreate = await v3Post(
        context,
        `/api/v3/meta/bases/${masterId}/tables`,
        {
          title: 'NewMasterTable',
          fields: [{ title: 'X', type: 'SingleLineText' }],
        },
      );
      expect(
        masterTableCreate.status,
        `master tableCreate: ${JSON.stringify(masterTableCreate.body)}`,
      ).to.eq(403);

      // tableUpdate on master — blocked
      const masterTableUpdate = await v3Patch(
        context,
        `/api/v3/meta/bases/${masterId}/tables/${seedTableId}`,
        { title: 'GuardedTableRenamed' },
      );
      expect(
        masterTableUpdate.status,
        `master tableUpdate: ${JSON.stringify(masterTableUpdate.body)}`,
      ).to.eq(403);

      // tableDelete on master — blocked
      const masterTableDelete = await v3Delete(
        context,
        `/api/v3/meta/bases/${masterId}/tables/${seedTableId}`,
      );
      expect(
        masterTableDelete.status,
        `master tableDelete: ${JSON.stringify(masterTableDelete.body)}`,
      ).to.eq(403);

      // columnAdd on master — blocked
      const masterColumnAdd = await v3Post(
        context,
        `/api/v3/meta/bases/${masterId}/tables/${seedTableId}/fields`,
        { title: 'BlockedCol', type: 'SingleLineText' },
      );
      expect(
        masterColumnAdd.status,
        `master columnAdd: ${JSON.stringify(masterColumnAdd.body)}`,
      ).to.eq(403);
    });

    it('6.2: same ops succeed on the sandbox base', async () => {
      // tableCreate on sandbox — succeeds
      const sbxTableCreate = await v3Post(
        context,
        `/api/v3/meta/bases/${sandboxBaseId}/tables`,
        {
          title: 'SandboxTable',
          fields: [{ title: 'Y', type: 'SingleLineText' }],
        },
      );
      expect(
        sbxTableCreate.status,
        `sandbox tableCreate: ${JSON.stringify(sbxTableCreate.body)}`,
      ).to.eq(200);

      // columnAdd on sandbox — succeeds
      const sbxColumnAdd = await v3Post(
        context,
        `/api/v3/meta/bases/${sandboxBaseId}/tables/${sbxTableCreate.body.id}/fields`,
        { title: 'AllowedCol', type: 'SingleLineText' },
      );
      expect(
        sbxColumnAdd.status,
        `sandbox columnAdd: ${JSON.stringify(sbxColumnAdd.body)}`,
      ).to.eq(200);

      // tableDelete on sandbox — succeeds
      const sbxTableDelete = await v3Delete(
        context,
        `/api/v3/meta/bases/${sandboxBaseId}/tables/${sbxTableCreate.body.id}`,
      );
      expect(
        sbxTableDelete.status,
        `sandbox tableDelete: ${JSON.stringify(sbxTableDelete.body)}`,
      ).to.eq(200);
    });

    it('6.3: master mutations are unblocked after sandboxDelete', async () => {
      // sandboxDelete tears down the sandbox + clears is_sandbox_production.
      const del = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'sandboxDelete' },
        {},
      );
      expect(del.status, `sandboxDelete: ${JSON.stringify(del.body)}`).to.eq(
        200,
      );
      await QueueService.queue.onIdle();

      // tableCreate on master — should now succeed.
      const postDeleteCreate = await v3Post(
        context,
        `/api/v3/meta/bases/${masterId}/tables`,
        {
          title: 'PostDeleteTable',
          fields: [{ title: 'Z', type: 'SingleLineText' }],
        },
      );
      expect(
        postDeleteCreate.status,
        `master tableCreate after sandboxDelete: ${JSON.stringify(postDeleteCreate.body)}`,
      ).to.eq(200);

      // columnAdd on master — should also succeed now.
      const postDeleteColAdd = await v3Post(
        context,
        `/api/v3/meta/bases/${masterId}/tables/${seedTableId}/fields`,
        { title: 'PostDeleteCol', type: 'SingleLineText' },
      );
      expect(
        postDeleteColAdd.status,
        `master columnAdd after sandboxDelete: ${JSON.stringify(postDeleteColAdd.body)}`,
      ).to.eq(200);

      // Reference seedColId so the unused-var lint doesn't fire — we need it
      // wired into the fixture for symmetry across tests but don't exercise
      // it directly here.
      void seedColId;
    });
  });
}
