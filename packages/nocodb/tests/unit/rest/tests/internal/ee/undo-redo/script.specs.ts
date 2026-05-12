import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { internalPost } from '~test/factory/internal';
import { Script } from '~/models';
import { baseScope } from '~test/rest/tests/internal/ee/undo-redo/shared';

export const scriptCreateSpec: RoundTripSpec<{}> = {
  forward_op: 'scriptCreate',
  setup: async () => ({}),
  forward: (ctx, env) =>
    internalPost(
      ctx,
      env,
      { operation: 'createScript' },
      { title: `Script_${Date.now()}`, script: 'return 1;' }
    ),
  entityId: (r) => r.body.id,
  scope: baseScope,
  assertExists: async (ctx, env, _fx, id) => {
    const s = await Script.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(s?.id, '[scriptCreate] id preserved across redo').to.equal(id);
  },
  assertGone: async (ctx, env, _fx, id) => {
    const s = await Script.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(!!s).to.equal(false);
  },
};

interface ScriptFx {
  scriptId: string;
  originalTitle: string;
}

async function setupScript(ctx: Context, env: TestEnv): Promise<ScriptFx> {
  const title = `S_${Date.now()}`;
  const s = await internalPost(
    ctx,
    env,
    { operation: 'createScript' },
    { title, script: 'return 1;' },
  );
  return { scriptId: s.body.id, originalTitle: title };
}

export const scriptUpdateSpec: RoundTripSpec<ScriptFx> = {
  forward_op: 'scriptUpdate',
  setup: setupScript,
  // OperationName.scriptUpdate ⇒ API `updateScript`. Controller reads
  // payload.id for the target (internal.controller:468).
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'updateScript' },
      { id: fx.scriptId, title: 'RenamedScript' }
    ),
  entityId: (_r, fx) => fx.scriptId,
  // dynamicScope: title-only body lands on base, but the body MUST carry
  // the script id (controller reads payload.id), and `id` isn't a sidebar
  // field for scriptUpdate (scope.ts:65). So the row records on the script
  // stack — match it here.
  scope: (env, fx) => [
    { type: 'script', id: fx.scriptId },
    { type: 'base', id: env.baseId },
  ],
  assertExists: async (ctx, env, fx) => {
    const s = await Script.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.scriptId,
    );
    expect(s.title).to.equal('RenamedScript');
  },
  assertGone: async (ctx, env, fx) => {
    const s = await Script.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.scriptId,
    );
    expect(s.title).to.equal(fx.originalTitle);
  },
};

export const scriptDeleteSpec: RoundTripSpec<ScriptFx> = {
  forward_op: 'scriptDelete',
  forwardIsDelete: true,
  setup: setupScript,
  // OperationName.scriptDelete ⇒ API `deleteScript`. Controller reads
  // payload.id (internal.controller:475).
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'deleteScript' },
      { id: fx.scriptId }
    ),
  entityId: (_r, fx) => fx.scriptId,
  scope: baseScope,
  assertExists: async (_ctx, env, fx) => {
    const s = await Script.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.scriptId,
    ).catch(() => null);
    expect(!!s).to.equal(true);
  },
  assertGone: async (_ctx, env, fx) => {
    const s = await Script.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.scriptId,
    ).catch(() => null);
    expect(!!s).to.equal(false);
  },
};

export const scriptDuplicateSpec: RoundTripSpec<ScriptFx> = {
  forward_op: 'scriptDuplicate',
  setup: setupScript,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'duplicateScript' },
      { id: fx.scriptId },
    ),
  entityId: (r) => r.body.id,
  scope: baseScope,
  assertExists: async (_ctx, env, _fx, id) => {
    const s = await Script.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(s?.id, '[scriptDuplicate] duplicate exists').to.equal(id);
  },
  assertGone: async (_ctx, env, _fx, id) => {
    const s = await Script.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(!!s, '[scriptDuplicate] duplicate gone after undo').to.equal(false);
  },
};

export const scriptSpecs: RoundTripSpec<any>[] = [
  scriptCreateSpec,
  scriptUpdateSpec,
  scriptDeleteSpec,
  scriptDuplicateSpec,
];
