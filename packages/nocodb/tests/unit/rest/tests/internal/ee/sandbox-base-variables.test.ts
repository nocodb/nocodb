import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import { createV3Base } from '~test/factory/base';
import { Base, BaseVariable, Sandbox, SandboxChangelog } from '~/models';
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

export function sandboxBaseVariablesTests() {
  describe('Sandbox - Base variables', () => {
    let context: Context;
    let workspaceId: string;
    let masterId: string;
    let sandboxBaseId: string;
    let masterCtx: { workspace_id: string; base_id: string };
    let sandboxCtx: { workspace_id: string; base_id: string };

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;
      const master = await createV3Base(context, `bv_${Date.now()}`);
      masterId = master.id;
      sandboxBaseId = await manualSandboxSetup(context, workspaceId, masterId);
      masterCtx = { workspace_id: workspaceId, base_id: masterId };
      sandboxCtx = { workspace_id: workspaceId, base_id: sandboxBaseId };
    });

    it('7.1 + 7.2: create var in sandbox, merge → master has it; sandbox row flips to is_inherited', async () => {
      const bvRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'baseVariableCreate' },
        {
          key: 'BV_KEY',
          value: 'sandbox-initial',
          type: 'text',
          inheritance: 'editable',
        },
      );
      expect(
        bvRes.status,
        `baseVariableCreate: ${JSON.stringify(bvRes.body)}`,
      ).to.eq(200);
      const bvId = bvRes.body.id;

      // Pre-merge: sandbox row is local (is_inherited=false), no master row yet.
      const sbxBefore = await BaseVariable.get(sandboxCtx, bvId);
      expect(sbxBefore?.is_inherited, 'pre-merge sandbox row not inherited').to
        .not.eq(true);

      const masterBefore = await BaseVariable.get(masterCtx, bvId);
      expect(masterBefore, 'pre-merge: master has no var yet').to.not.exist;

      await runSandboxMerge(context, workspaceId, sandboxBaseId);

      // 7.1 — master now has the variable with the same id and value.
      const masterVar = await BaseVariable.get(masterCtx, bvId);
      expect(masterVar, 'master var after merge').to.exist;
      expect(masterVar!.key).to.eq('BV_KEY');
      expect(masterVar!.value).to.eq('sandbox-initial');

      // 7.2 — sandbox row is now flagged is_inherited=true. The processor
      // also flips is_overridden=true so the sandbox value stays visible past
      // the editable-inherited masking rule.
      const sbxAfter = await BaseVariable.get(sandboxCtx, bvId);
      expect(sbxAfter?.is_inherited, 'sandbox row promoted to inherited').to.eq(
        true,
      );
    });

    it('7.3 + 7.4: local update on inherited var skips changelog; re-merge is a no-op', async () => {
      // Cycle 1: create + merge (so the var is inherited going forward).
      const bvRes = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'baseVariableCreate' },
        {
          key: 'BV_LOCAL',
          value: 'master-value',
          type: 'text',
          inheritance: 'editable',
        },
      );
      expect(bvRes.status).to.eq(200);
      const bvId = bvRes.body.id;
      await runSandboxMerge(context, workspaceId, sandboxBaseId);

      const masterBefore = await BaseVariable.get(masterCtx, bvId);
      expect(masterBefore!.value).to.eq('master-value');

      // Sandbox-side local update on the now-inherited var.
      const upd = await internalPost(
        context,
        workspaceId,
        sandboxBaseId,
        { operation: 'baseVariableUpdate', variableId: bvId },
        { value: 'sandbox-override' },
      );
      expect(upd.status, `baseVariableUpdate: ${JSON.stringify(upd.body)}`).to.eq(
        200,
      );

      // 7.3 — sandbox row sees the override locally...
      const sbxAfter = await BaseVariable.get(sandboxCtx, bvId);
      expect(sbxAfter!.value, 'sandbox local override applied').to.eq(
        'sandbox-override',
      );

      // ...but the changelog for `baseVariableUpdate` was skipped via
      // `skipIf: v.is_inherited === true`.
      const pending = await SandboxChangelog.listByBaseId(sandboxBaseId, {
        excludeMerged: true,
      });
      const pendingNames = pending.map((e) => {
        const m = typeof e.meta === 'string' ? JSON.parse(e.meta) : e.meta;
        return m?.command?.name as string | undefined;
      });
      expect(
        pendingNames,
        'baseVariableUpdate should not be in pending changelog',
      ).to.not.include('baseVariableUpdate');

      // 7.4 — re-merge is a no-op; master still has the original value.
      await runSandboxMerge(context, workspaceId, sandboxBaseId);

      const masterAfter = await BaseVariable.get(masterCtx, bvId);
      expect(
        masterAfter!.value,
        'master untouched by sandbox-local override',
      ).to.eq('master-value');
    });
  });
}
