import { expect } from 'chai';
import type { RoundTripSpec } from './harness';
import { internalGet, internalPost } from '~test/factory/internal';
import { createTable } from '~test/factory/v3';
import { tableScope } from '~test/rest/tests/internal/ee/undo-redo/shared';

export const rlsPolicyCreateSpec: RoundTripSpec<{ tableId: string }> = {
  forward_op: 'rlsPolicyCreate',
  setup: async (ctx, env) => {
    const t = await createTable(ctx, env, `rlstbl_${Date.now()}`);
    return { tableId: t.id };
  },
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'rlsPolicyCreate' },
      {
        fk_model_id: fx.tableId,
        title: 'RLS_test',
      }
    ),
  entityId: (r) => r.body.id,
  scope: tableScope,
  // `rlsPolicyList` is a GET op (RlsGet.operations.ts) — must use internalGet.
  assertExists: async (ctx, env, fx, id) => {
    const r = await internalGet(ctx, env, {
      operation: 'rlsPolicyList',
      tableId: fx.tableId,
    });
    const list = Array.isArray(r.body)
      ? r.body
      : r.body?.list ?? [];
    expect(list.map((p: any) => p.id)).to.include(id);
  },
  assertGone: async (ctx, env, fx, id) => {
    const r = await internalGet(ctx, env, {
      operation: 'rlsPolicyList',
      tableId: fx.tableId,
    });
    const list = Array.isArray(r.body)
      ? r.body
      : r.body?.list ?? [];
    expect(list.map((p: any) => p.id)).to.not.include(id);
  },
};

export const rlsSpecs: RoundTripSpec<any>[] = [rlsPolicyCreateSpec];
