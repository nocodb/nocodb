import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { internalPost, readSorts } from '~test/factory/internal';
import { setupTableView, viewScope } from '~test/rest/tests/internal/ee/undo-redo/shared';
import type { TableViewFx } from '~test/rest/tests/internal/ee/undo-redo/shared';

export const sortCreateSpec: RoundTripSpec<TableViewFx> = {
  forward_op: 'sortCreate',
  setup: setupTableView,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'sortCreate', viewId: fx.viewId },
      { fk_column_id: fx.colId, direction: 'asc' }
    ),
  entityId: (r) => r.body.id,
  scope: (env, fx) => viewScope(env, fx),
  assertExists: async (ctx, env, fx, id) => {
    const sorts = await readSorts(ctx, env, fx.viewId);
    expect(sorts.map((s: any) => s.id)).to.include(id);
  },
  assertGone: async (ctx, env, fx, id) => {
    const sorts = await readSorts(ctx, env, fx.viewId);
    expect(sorts.map((s: any) => s.id)).to.not.include(id);
  },
};

interface SortFx extends TableViewFx {
  sortId: string;
}

async function setupExistingSort(ctx: Context, env: TestEnv): Promise<SortFx> {
  const fx = await setupTableView(ctx, env);
  // `ctx` arrives untraced from runSpec(setup) — this call stays off the log stack.
  const created = await internalPost(
    ctx,
    env,
    { operation: 'sortCreate', viewId: fx.viewId },
    { fk_column_id: fx.colId, direction: 'asc' },
  );
  return { ...fx, sortId: created.body.id };
}

export const sortUpdateSpec: RoundTripSpec<SortFx> = {
  forward_op: 'sortUpdate',
  setup: setupExistingSort,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'sortUpdate', sortId: fx.sortId },
      { direction: 'desc' }
    ),
  entityId: (_r, fx) => fx.sortId,
  scope: viewScope,
  assertExists: async (ctx, env, fx) => {
    const sorts = await readSorts(ctx, env, fx.viewId);
    const row = sorts.find((s: any) => s.id === fx.sortId);
    expect(row?.direction).to.equal('desc');
  },
  assertGone: async (ctx, env, fx) => {
    const sorts = await readSorts(ctx, env, fx.viewId);
    const row = sorts.find((s: any) => s.id === fx.sortId);
    expect(row?.direction).to.equal('asc');
  },
};

export const sortDeleteSpec: RoundTripSpec<SortFx> = {
  forward_op: 'sortDelete',
  forwardIsDelete: true,
  // sortDelete is a hard-delete; inverse is sortCreate (with the original
  // body in inverse_params). NOT trashRestore — sorts aren't soft-deleted.
  setup: setupExistingSort,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'sortDelete', sortId: fx.sortId },
      {}
    ),
  entityId: (_r, fx) => fx.sortId,
  scope: viewScope,
  assertExists: async (ctx, env, fx) => {
    const sorts = await readSorts(ctx, env, fx.viewId);
    expect(sorts.map((s: any) => s.id)).to.include(fx.sortId);
  },
  assertGone: async (ctx, env, fx) => {
    const sorts = await readSorts(ctx, env, fx.viewId);
    expect(sorts.map((s: any) => s.id)).to.not.include(fx.sortId);
  },
};

export const sortSpecs: RoundTripSpec<any>[] = [
  sortCreateSpec,
  sortUpdateSpec,
  sortDeleteSpec,
];
