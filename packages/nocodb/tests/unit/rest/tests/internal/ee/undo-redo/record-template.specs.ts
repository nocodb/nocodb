import { expect } from 'chai';
import request from 'supertest';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import RecordTemplate from '~/models/RecordTemplate';
import { setupTable, tableScope } from '~test/rest/tests/internal/ee/undo-redo/shared';
import type { TableFx } from '~test/rest/tests/internal/ee/undo-redo/shared';

export const recordTemplateCreateSpec: RoundTripSpec<TableFx> = {
  forward_op: 'recordTemplateCreate',
  setup: setupTable,
  forward: (ctx, env, fx) =>
    request(ctx.app)
      .post(
        `/api/v1/db/meta/bases/${env.baseId}/tables/${fx.tableId}/record-templates`,
      )
      .set('xc-token', ctx.xc_token)
      .set('x-nc-tab-id', ctx.tabId ?? '')
      .send({ title: 'Tpl', template_data: { fields: {} } }),
  entityId: (r) => r.body.id,
  scope: tableScope,
  assertExists: async (ctx, env, _fx, id) => {
    const t = await RecordTemplate.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(t?.id, '[recordTemplateCreate] id preserved across redo').to.equal(id);
  },
  assertGone: async (ctx, env, _fx, id) => {
    const t = await RecordTemplate.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(!!t).to.equal(false);
  },
};

interface RtFx extends TableFx {
  rtId: string;
  originalTitle: string;
}

async function setupRt(ctx: Context, env: TestEnv): Promise<RtFx> {
  const t = await setupTable(ctx, env);
  const title = `Tpl_${Date.now()}`;
  // Setup uses the REST create endpoint without a tab id so the create
  // itself doesn't pollute the test's undo stack.
  const r = await request(ctx.app)
    .post(
      `/api/v1/db/meta/bases/${env.baseId}/tables/${t.tableId}/record-templates`,
    )
    .set('xc-token', ctx.xc_token)
    .send({ title, template_data: { fields: {} } });
  return { ...t, rtId: r.body.id, originalTitle: title };
}

export const recordTemplateUpdateSpec: RoundTripSpec<RtFx> = {
  forward_op: 'recordTemplateUpdate',
  setup: setupRt,
  // REST PATCH on the template id (record-templates.controller.ts:115).
  forward: (ctx, env, fx) =>
    request(ctx.app)
      .patch(
        `/api/v1/db/meta/bases/${env.baseId}/record-templates/${fx.rtId}`,
      )
      .set('xc-token', ctx.xc_token)
      .set('x-nc-tab-id', ctx.tabId ?? '')
      .send({ title: 'TplRenamed' }),
  entityId: (_r, fx) => fx.rtId,
  scope: tableScope,
  assertExists: async (_ctx, env, fx) => {
    const t = await RecordTemplate.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.rtId,
    );
    expect(t.title).to.equal('TplRenamed');
  },
  assertGone: async (_ctx, env, fx) => {
    const t = await RecordTemplate.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.rtId,
    );
    expect(t.title).to.equal(fx.originalTitle);
  },
};

export const recordTemplateDeleteSpec: RoundTripSpec<RtFx> = {
  forward_op: 'recordTemplateDelete',
  forwardIsDelete: true,
  setup: setupRt,
  // REST DELETE on the template id.
  forward: (ctx, env, fx) =>
    request(ctx.app)
      .delete(
        `/api/v1/db/meta/bases/${env.baseId}/record-templates/${fx.rtId}`,
      )
      .set('xc-token', ctx.xc_token)
      .set('x-nc-tab-id', ctx.tabId ?? ''),
  entityId: (_r, fx) => fx.rtId,
  scope: tableScope,
  // Hard-delete: inverse is recordTemplateCreate with the snapshot in
  // inverse_params (see RecordTemplateDeleteContract). NOT trashRestore.
  assertExists: async (_ctx, env, fx) => {
    const t = await RecordTemplate.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.rtId,
    ).catch(() => null);
    expect(!!t).to.equal(true);
  },
  assertGone: async (_ctx, env, fx) => {
    const t = await RecordTemplate.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.rtId,
    ).catch(() => null);
    expect(!!t).to.equal(false);
  },
};

export const recordTemplateSpecs: RoundTripSpec<any>[] = [
  recordTemplateCreateSpec,
  recordTemplateUpdateSpec,
  recordTemplateDeleteSpec,
];
