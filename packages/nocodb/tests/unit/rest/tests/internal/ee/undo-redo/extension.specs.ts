import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { internalPost } from '~test/factory/internal';
import { Extension } from '~/models';

export const extensionCreateSpec: RoundTripSpec<{}> = {
  forward_op: 'extensionCreate',
  setup: async () => ({}),
  forward: (ctx, env) =>
    internalPost(
      ctx,
      env,
      { operation: 'extensionCreate' },
      {
        title: 'Ext',
        extension_id: 'data-exporter',
        kv_store: {},
        meta: {},
      }
    ),
  entityId: (r) => r.body.id,
  scope: (env) => [{ type: 'base', id: env.baseId }],
  assertExists: async (ctx, env, _fx, id) => {
    const e = await Extension.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(e?.id, '[extensionCreate] id preserved across redo').to.equal(id);
  },
  assertGone: async (ctx, env, _fx, id) => {
    const e = await Extension.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(!!e).to.equal(false);
  },
};

interface ExtensionFx {
  extId: string;
  originalTitle: string;
}

async function setupExtension(ctx: Context, env: TestEnv): Promise<ExtensionFx> {
  const title = `Ext_${Date.now()}`;
  const r = await internalPost(
    ctx,
    env,
    { operation: 'extensionCreate' },
    { title, extension_id: 'data-exporter', kv_store: {}, meta: {} },
  );
  return { extId: r.body.id, originalTitle: title };
}

export const extensionUpdateSpec: RoundTripSpec<ExtensionFx> = {
  forward_op: 'extensionUpdate',
  setup: setupExtension,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'extensionUpdate', extensionId: fx.extId },
      { title: 'ExtRenamed' }
    ),
  entityId: (_r, fx) => fx.extId,
  scope: (env) => [{ type: 'base', id: env.baseId }],
  assertExists: async (_ctx, env, fx) => {
    const e = await Extension.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.extId,
    );
    expect(e.title).to.equal('ExtRenamed');
  },
  assertGone: async (_ctx, env, fx) => {
    const e = await Extension.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.extId,
    );
    expect(e.title).to.equal(fx.originalTitle);
  },
};

export const extensionDeleteSpec: RoundTripSpec<ExtensionFx> = {
  forward_op: 'extensionDelete',
  forwardIsDelete: true,
  setup: setupExtension,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'extensionDelete', extensionId: fx.extId },
      {}
    ),
  entityId: (_r, fx) => fx.extId,
  scope: (env) => [{ type: 'base', id: env.baseId }],
  assertExists: async (_ctx, env, fx) => {
    const e = await Extension.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.extId,
    ).catch(() => null);
    expect(!!e).to.equal(true);
  },
  assertGone: async (_ctx, env, fx) => {
    const e = await Extension.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.extId,
    ).catch(() => null);
    expect(!!e).to.equal(false);
  },
};

export const extensionSpecs: RoundTripSpec<any>[] = [
  extensionCreateSpec,
  extensionUpdateSpec,
  extensionDeleteSpec,
];
