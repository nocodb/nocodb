import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { internalPost, readFilters } from '~test/factory/internal';
import { setupTableView, viewScope } from '~test/rest/tests/internal/ee/undo-redo/shared';
import type { TableViewFx } from '~test/rest/tests/internal/ee/undo-redo/shared';

export const filterCreateSpec: RoundTripSpec<TableViewFx> = {
  forward_op: 'filterCreate',
  setup: setupTableView,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'filterCreate', viewId: fx.viewId },
      {
        fk_column_id: fx.colId,
        comparison_op: 'eq',
        value: 'foo',
        logical_op: 'and',
      }
    ),
  entityId: (r) => r.body.id,
  scope: viewScope,
  assertExists: async (ctx, env, fx, id) => {
    const filters = await readFilters(ctx, env, fx.viewId);
    expect(flattenFilterIds(filters)).to.include(id);
  },
  assertGone: async (ctx, env, fx, id) => {
    const filters = await readFilters(ctx, env, fx.viewId);
    expect(flattenFilterIds(filters)).to.not.include(id);
  },
};

interface FilterFx extends TableViewFx {
  filterId: string;
}

async function setupExistingFilter(ctx: Context, env: TestEnv): Promise<FilterFx> {
  const fx = await setupTableView(ctx, env);
  const created = await internalPost(
    ctx,
    env,
    { operation: 'filterCreate', viewId: fx.viewId },
    {
      fk_column_id: fx.colId,
      comparison_op: 'eq',
      value: 'foo',
      logical_op: 'and',
    },
  );
  return { ...fx, filterId: created.body.id };
}

export const filterUpdateSpec: RoundTripSpec<FilterFx> = {
  forward_op: 'filterUpdate',
  setup: setupExistingFilter,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'filterUpdate', filterId: fx.filterId },
      { value: 'bar' }
    ),
  entityId: (_r, fx) => fx.filterId,
  scope: viewScope,
  assertExists: async (ctx, env, fx) => {
    const filters = await readFilters(ctx, env, fx.viewId);
    const row = filters.find((f: any) => f.id === fx.filterId);
    expect(row?.value).to.equal('bar');
  },
  assertGone: async (ctx, env, fx) => {
    const filters = await readFilters(ctx, env, fx.viewId);
    const row = filters.find((f: any) => f.id === fx.filterId);
    expect(row?.value).to.equal('foo');
  },
};

export const filterDeleteSpec: RoundTripSpec<FilterFx> = {
  forward_op: 'filterDelete',
  forwardIsDelete: true,
  setup: setupExistingFilter,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'filterDelete', filterId: fx.filterId },
      {}
    ),
  entityId: (_r, fx) => fx.filterId,
  scope: viewScope,
  assertExists: async (ctx, env, fx) => {
    const filters = await readFilters(ctx, env, fx.viewId);
    expect(flattenFilterIds(filters)).to.include(fx.filterId);
  },
  assertGone: async (ctx, env, fx) => {
    const filters = await readFilters(ctx, env, fx.viewId);
    expect(flattenFilterIds(filters)).to.not.include(fx.filterId);
  },
};

function flattenFilterIds(list: any[]): string[] {
  const ids: string[] = [];
  const walk = (rows: any[]) => {
    for (const r of rows) {
      if (r?.id) ids.push(r.id);
      if (Array.isArray(r?.children) && r.children.length) walk(r.children);
    }
  };
  walk(list);
  return ids;
}

interface BulkFilterFx extends TableViewFx {
  filterIds: string[];
}

async function setupTwoFilters(
  ctx: Context,
  env: TestEnv,
): Promise<BulkFilterFx> {
  const fx = await setupTableView(ctx, env);
  const ids: string[] = [];
  for (const value of ['a', 'b']) {
    const r = await internalPost(
      ctx,
      env,
      { operation: 'filterCreate', viewId: fx.viewId },
      {
        fk_column_id: fx.colId,
        comparison_op: 'eq',
        value,
        logical_op: 'and',
      },
    );
    ids.push(r.body.id);
  }
  return { ...fx, filterIds: ids };
}

export const filterBulkLogicalOpUpdateSpec: RoundTripSpec<BulkFilterFx> = {
  forward_op: 'filterBulkLogicalOpUpdate',
  setup: setupTwoFilters,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'filterBulkLogicalOpUpdate' },
      {
        filters: fx.filterIds.map((filterId) => ({
          filterId,
          logical_op: 'or',
        })),
      },
    ),
  entityId: (_r, fx) => fx.filterIds[0],
  expectNullEntityId: true,
  scope: viewScope,
  assertExists: async (ctx, env, fx) => {
    const filters = await readFilters(ctx, env, fx.viewId);
    for (const id of fx.filterIds) {
      const row = filters.find((f: any) => f.id === id);
      expect(row?.logical_op, `filter ${id}`).to.equal('or');
    }
  },
  assertGone: async (ctx, env, fx) => {
    const filters = await readFilters(ctx, env, fx.viewId);
    for (const id of fx.filterIds) {
      const row = filters.find((f: any) => f.id === id);
      expect(row?.logical_op, `filter ${id}`).to.equal('and');
    }
  },
};

export const filterSpecs: RoundTripSpec<any>[] = [
  filterCreateSpec,
  filterUpdateSpec,
  filterDeleteSpec,
  filterBulkLogicalOpUpdateSpec,
];
