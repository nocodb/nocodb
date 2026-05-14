import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { internalPost } from '~test/factory/internal';
import { Hook } from '~/models';
import { setupTable, tableScope } from '~test/rest/tests/internal/ee/undo-redo/shared';
import type { TableFx } from '~test/rest/tests/internal/ee/undo-redo/shared';

export const hookCreateSpec: RoundTripSpec<TableFx> = {
  forward_op: 'hookCreate',
  setup: setupTable,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'hookCreate', tableId: fx.tableId },
      {
        title: 'TestHook',
        // V1/V2 hooks are deprecated; service only accepts version: 'v3'
        // (hooks.service.ts:36 SUPPORTED_HOOK_VERSION = ['v3']).
        version: 'v3',
        event: 'after',
        operation: ['insert'],
        notification: { type: 'URL', payload: { method: 'POST', path: 'http://example.com' } },
      }
    ),
  entityId: (r) => r.body.id,
  scope: tableScope,
  assertExists: async (ctx, env, _fx, id) => {
    const h = await Hook.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(h?.id, '[hookCreate] id preserved across redo').to.equal(id);
  },
  assertGone: async (ctx, env, _fx, id) => {
    const h = await Hook.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(!!h).to.equal(false);
  },
};

interface HookFx extends TableFx {
  hookId: string;
  originalTitle: string;
}

async function setupHook(ctx: Context, env: TestEnv): Promise<HookFx> {
  const t = await setupTable(ctx, env);
  const title = `HookOrig_${Date.now()}`;
  const r = await internalPost(
    ctx,
    env,
    { operation: 'hookCreate', tableId: t.tableId },
    {
      title,
      version: 'v3',
      event: 'after',
      operation: ['insert'],
      notification: { type: 'URL', payload: { method: 'POST', path: 'http://example.com' } },
    },
  );
  return { ...t, hookId: r.body.id, originalTitle: title };
}

export const hookUpdateSpec: RoundTripSpec<HookFx> = {
  forward_op: 'hookUpdate',
  setup: setupHook,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'hookUpdate', hookId: fx.hookId },
      // V1/V2 hooks deprecated; service rejects without version: 'v3'.
      // hookUpdate's validation re-requires event/operation/notification
      // even though they're already set on the record — pass them through.
      {
        version: 'v3',
        title: 'HookRenamed',
        event: 'after',
        operation: ['insert'],
        notification: {
          type: 'URL',
          payload: { method: 'POST', path: 'http://example.com' },
        },
      }
    ),
  entityId: (_r, fx) => fx.hookId,
  scope: tableScope,
  assertExists: async (_ctx, env, fx) => {
    const h = await Hook.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.hookId,
    );
    expect(h.title).to.equal('HookRenamed');
  },
  assertGone: async (_ctx, env, fx) => {
    const h = await Hook.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.hookId,
    );
    expect(h.title).to.equal(fx.originalTitle);
  },
};

export const hookDeleteSpec: RoundTripSpec<HookFx> = {
  forward_op: 'hookDelete',
  forwardIsDelete: true,
  setup: setupHook,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'hookDelete', hookId: fx.hookId },
      {}
    ),
  entityId: (_r, fx) => fx.hookId,
  scope: tableScope,
  assertExists: async (_ctx, env, fx) => {
    const h = await Hook.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.hookId,
    ).catch(() => null);
    expect(!!h).to.equal(true);
  },
  assertGone: async (_ctx, env, fx) => {
    const h = await Hook.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.hookId,
    ).catch(() => null);
    expect(!!h).to.equal(false);
  },
};

export const hookSpecs: RoundTripSpec<any>[] = [
  hookCreateSpec,
  hookUpdateSpec,
  hookDeleteSpec,
];
