import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { internalPost } from '~test/factory/internal';
import { createTable } from '~test/factory/v3';
import { ViewSection } from '~/models';

// ── viewSection create/update/delete ──────────────────────────────

interface VsFx {
  tableId: string;
}

async function setupTableForVs(ctx: Context, env: TestEnv): Promise<VsFx> {
  const t = await createTable(ctx, env, `vsTbl_${Date.now()}`);
  return { tableId: t.id };
}

export const viewSectionCreateSpec: RoundTripSpec<VsFx> = {
  forward_op: 'viewSectionCreate',
  setup: setupTableForVs,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'viewSectionCreate', tableId: fx.tableId },
      { title: `Sec_${Date.now()}` }
    ),
  entityId: (r) => r.body.id,
  scope: (env, fx) => [
    { type: 'table', id: fx.tableId },
    { type: 'base', id: env.baseId },
  ],
  assertExists: async (_ctx, env, _fx, id) => {
    const s = await ViewSection.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(s?.id, '[viewSectionCreate] id preserved across redo').to.equal(id);
  },
  assertGone: async (_ctx, env, _fx, id) => {
    const s = await ViewSection.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      id,
    ).catch(() => null);
    expect(!!s).to.equal(false);
  },
};

interface VsExistingFx extends VsFx {
  sectionId: string;
  originalTitle: string;
}

async function setupExistingViewSection(
  ctx: Context,
  env: TestEnv,
): Promise<VsExistingFx> {
  const base = await setupTableForVs(ctx, env);
  const title = `SecOrig_${Date.now()}`;
  const r = await internalPost(
    ctx,
    env,
    { operation: 'viewSectionCreate', tableId: base.tableId },
    { title },
  );
  return { ...base, sectionId: r.body.id, originalTitle: title };
}

export const viewSectionUpdateSpec: RoundTripSpec<VsExistingFx> = {
  forward_op: 'viewSectionUpdate',
  setup: setupExistingViewSection,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      // ViewSectionPost.operations.ts reads req.query.sectionId.
      { operation: 'viewSectionUpdate', sectionId: fx.sectionId },
      { title: 'SecRenamed' }
    ),
  entityId: (_r, fx) => fx.sectionId,
  scope: (env, fx) => [
    { type: 'table', id: fx.tableId },
    { type: 'base', id: env.baseId },
  ],
  assertExists: async (_ctx, env, fx) => {
    const s = await ViewSection.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.sectionId,
    );
    expect(s.title).to.equal('SecRenamed');
  },
  assertGone: async (_ctx, env, fx) => {
    const s = await ViewSection.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.sectionId,
    );
    expect(s.title).to.equal(fx.originalTitle);
  },
};

export const viewSectionDeleteSpec: RoundTripSpec<VsExistingFx> = {
  forward_op: 'viewSectionDelete',
  forwardIsDelete: true,
  setup: setupExistingViewSection,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'viewSectionDelete', sectionId: fx.sectionId },
      {}
    ),
  entityId: (_r, fx) => fx.sectionId,
  scope: (env, fx) => [
    { type: 'table', id: fx.tableId },
    { type: 'base', id: env.baseId },
  ],
  assertExists: async (_ctx, env, fx) => {
    const s = await ViewSection.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.sectionId,
    ).catch(() => null);
    expect(!!s).to.equal(true);
  },
  assertGone: async (_ctx, env, fx) => {
    const s = await ViewSection.get(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      fx.sectionId,
    ).catch(() => null);
    expect(!!s).to.equal(false);
  },
};

export const viewSectionSpecs: RoundTripSpec<any>[] = [
  viewSectionCreateSpec,
  viewSectionUpdateSpec,
  viewSectionDeleteSpec,
];
