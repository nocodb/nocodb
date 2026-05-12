import { expect } from 'chai';
import request from 'supertest';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { internalPost, untracedCtx } from '~test/factory/internal';
import { createTable } from '~test/factory/v3';
import { tableScope } from '~test/rest/tests/internal/ee/undo-redo/shared';
import { Model } from '~/models';

interface LinkFx {
  parentTableId: string;
  childTableId: string;
  linkColumnId: string;
  parentRow1Id: string;
  parentRow2Id: string;
  childRow1Id: string;
  childRow2Id: string;
}

const v3Insert = async (
  ctx: Context,
  env: TestEnv,
  tableId: string,
  fields: Record<string, any>,
): Promise<string> => {
  const req = request(ctx.app)
    .post(`/api/v3/data/${env.baseId}/${tableId}/records`)
    .set('xc-token', ctx.xc_token);
  const r = await req.send([{ fields }]);
  expect(r.status, `v3 insert: ${JSON.stringify(r.body)}`).to.eq(200);
  const row = (r.body?.records ?? r.body)[0] ?? r.body;
  return String(row?.id ?? row?.Id);
};

const nestedListLinked = async (
  ctx: Context,
  env: TestEnv,
  modelId: string,
  columnId: string,
  rowId: string,
): Promise<any[]> => {
  const r = await request(ctx.app)
    .get(
      `/api/v3/data/${env.baseId}/${modelId}/links/${columnId}/${rowId}`,
    )
    .set('xc-token', ctx.xc_token);
  expect(r.status, `nested list: ${JSON.stringify(r.body).slice(0, 200)}`).to.eq(200);
  return r.body?.records ?? r.body?.list ?? r.body ?? [];
};

async function setupTwoTablesWithMmLink(
  ctx: Context,
  env: TestEnv,
): Promise<LinkFx> {
  const untraced = untracedCtx(ctx);
  const parent = await createTable(untraced, env, `linkP_${Date.now()}`);
  const child = await createTable(untraced, env, `linkC_${Date.now()}`);

  const colRes = await internalPost(
    untraced,
    env,
    { operation: 'columnAdd', tableId: parent.id },
    {
      title: 'Children',
      column_name: 'Children',
      uidt: 'Links',
      parentId: parent.id,
      childId: child.id,
      type: 'mm',
    },
  );
  expect(colRes.status, `columnAdd LTAR: ${JSON.stringify(colRes.body)}`).to.eq(200);

  // columnAdd returns the parent Model (not the column) — re-list to find
  // the new link column id (see column.specs.ts notes for the same quirk).
  const model = await Model.getWithInfo(
    { workspace_id: env.workspaceId, base_id: env.baseId },
    { id: parent.id },
  );
  const linkCol = (model as any).columns?.find(
    (c: any) => c.title === 'Children',
  );
  expect(linkCol, 'link column must exist').to.exist;

  const parentRow1Id = await v3Insert(untraced, env, parent.id, { Title: 'P1' });
  const parentRow2Id = await v3Insert(untraced, env, parent.id, { Title: 'P2' });
  const childRow1Id = await v3Insert(untraced, env, child.id, { Title: 'C1' });
  const childRow2Id = await v3Insert(untraced, env, child.id, { Title: 'C2' });

  return {
    parentTableId: parent.id,
    childTableId: child.id,
    linkColumnId: linkCol.id,
    parentRow1Id,
    parentRow2Id,
    childRow1Id,
    childRow2Id,
  };
}

export const recordLinkAddSpec: RoundTripSpec<LinkFx> = {
  forward_op: 'recordLinkAdd',
  setup: setupTwoTablesWithMmLink,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      {
        operation: 'nestedDataLink',
        tableId: fx.parentTableId,
        columnId: fx.linkColumnId,
        rowId: fx.parentRow1Id,
      },
      [fx.childRow1Id],
    ),
  entityId: (_r, fx) => fx.parentRow1Id,
  scope: (env, fx) => tableScope(env, { tableId: fx.parentTableId }),
  expectNullEntityId: true,
  // The link inverse re-runs the link side as unlink with the same child
  // ids; redo re-applies the original link. Both rounds end in the same
  // observable state, so a single cycle is enough.
  skipDoubleCycle: true,
  assertExists: async (ctx, env, fx) => {
    const linked = await nestedListLinked(
      ctx,
      env,
      fx.parentTableId,
      fx.linkColumnId,
      fx.parentRow1Id,
    );
    const ids = linked.map((r: any) => String(r?.id ?? r?.Id));
    expect(ids, '[recordLinkAdd] child linked').to.include(fx.childRow1Id);
  },
  assertGone: async (ctx, env, fx) => {
    const linked = await nestedListLinked(
      ctx,
      env,
      fx.parentTableId,
      fx.linkColumnId,
      fx.parentRow1Id,
    );
    const ids = linked.map((r: any) => String(r?.id ?? r?.Id));
    expect(ids, '[recordLinkAdd] child unlinked after undo').to.not.include(fx.childRow1Id);
  },
};

async function setupExistingLink(
  ctx: Context,
  env: TestEnv,
): Promise<LinkFx> {
  const fx = await setupTwoTablesWithMmLink(ctx, env);
  // Seed the link via the same wire path, with tab-id stripped so the
  // setup write doesn't pollute the per-tab undo stack.
  const untraced = untracedCtx(ctx);
  const seed = await request((untraced as any).app)
    .post(
      `/api/v3/data/${env.baseId}/${fx.parentTableId}/links/${fx.linkColumnId}/${fx.parentRow1Id}`,
    )
    .set('xc-token', untraced.xc_token)
    .send([{ id: fx.childRow1Id }]);
  expect(seed.status, `seed link: ${JSON.stringify(seed.body)}`).to.eq(200);
  return fx;
}

export const recordLinkRemoveSpec: RoundTripSpec<LinkFx> = {
  forward_op: 'recordLinkRemove',
  forwardIsDelete: true,
  setup: setupExistingLink,
  forward: (ctx, env, fx) => {
    const req = request(ctx.app)
      .delete(
        `/api/v3/data/${env.baseId}/${fx.parentTableId}/links/${fx.linkColumnId}/${fx.parentRow1Id}`,
      )
      .set('xc-token', ctx.xc_token);
    if (ctx.tabId) req.set('x-nc-tab-id', ctx.tabId);
    return req.send([{ id: fx.childRow1Id }]);
  },
  entityId: (_r, fx) => fx.parentRow1Id,
  scope: (env, fx) => tableScope(env, { tableId: fx.parentTableId }),
  expectNullEntityId: true,
  skipDoubleCycle: true,
  assertExists: async (ctx, env, fx) => {
    const linked = await nestedListLinked(
      ctx,
      env,
      fx.parentTableId,
      fx.linkColumnId,
      fx.parentRow1Id,
    );
    const ids = linked.map((r: any) => String(r?.id ?? r?.Id));
    expect(ids, '[recordLinkRemove] child still linked pre-forward').to.include(fx.childRow1Id);
  },
  assertGone: async (ctx, env, fx) => {
    const linked = await nestedListLinked(
      ctx,
      env,
      fx.parentTableId,
      fx.linkColumnId,
      fx.parentRow1Id,
    );
    const ids = linked.map((r: any) => String(r?.id ?? r?.Id));
    expect(ids, '[recordLinkRemove] child unlinked post-forward').to.not.include(fx.childRow1Id);
  },
};

async function setupSwapFixture(
  ctx: Context,
  env: TestEnv,
): Promise<LinkFx> {
  const fx = await setupExistingLink(ctx, env);
  return fx;
}

export const recordLinkSwapSpec: RoundTripSpec<LinkFx> = {
  forward_op: 'recordLinkSwap',
  setup: setupSwapFixture,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      {
        operation: 'nestedDataListCopyPasteOrDeleteAll',
        tableId: fx.parentTableId,
        columnId: fx.linkColumnId,
      },
      [
        {
          operation: 'copy',
          rowId: fx.parentRow1Id,
          columnId: fx.linkColumnId,
          fk_related_model_id: fx.childTableId,
        },
        {
          operation: 'paste',
          rowId: fx.parentRow2Id,
          columnId: fx.linkColumnId,
          fk_related_model_id: fx.childTableId,
        },
      ],
    ),
  entityId: (_r, fx) => fx.parentRow2Id,
  scope: (env, fx) => tableScope(env, { tableId: fx.parentTableId }),
  expectNullEntityId: true,
  skipDoubleCycle: true,
  assertExists: async (ctx, env, fx) => {
    // P2 now has the link copied from P1.
    const linked = await nestedListLinked(
      ctx,
      env,
      fx.parentTableId,
      fx.linkColumnId,
      fx.parentRow2Id,
    );
    const ids = linked.map((r: any) => String(r?.id ?? r?.Id));
    expect(ids, '[recordLinkSwap] P2 has C1 after paste').to.include(fx.childRow1Id);
  },
  assertGone: async (ctx, env, fx) => {
    const linked = await nestedListLinked(
      ctx,
      env,
      fx.parentTableId,
      fx.linkColumnId,
      fx.parentRow2Id,
    );
    const ids = linked.map((r: any) => String(r?.id ?? r?.Id));
    expect(ids, '[recordLinkSwap] P2 unlinked after undo').to.not.include(fx.childRow1Id);
  },
};

export const recordLinkSwapBulkSpec: RoundTripSpec<LinkFx> = {
  forward_op: 'recordLinkSwapBulk',
  setup: setupExistingLink,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      {
        operation: 'nestedDataBulkCopyPasteOrDeleteAll',
        tableId: fx.parentTableId,
      },
      [
        {
          columnId: fx.linkColumnId,
          data: [
            {
              operation: 'copy',
              rowId: fx.parentRow1Id,
              columnId: fx.linkColumnId,
              fk_related_model_id: fx.childTableId,
            },
            {
              operation: 'paste',
              rowId: fx.parentRow2Id,
              columnId: fx.linkColumnId,
              fk_related_model_id: fx.childTableId,
            },
          ],
        },
      ],
    ),
  entityId: (_r, fx) => fx.parentRow2Id,
  scope: (env, fx) => tableScope(env, { tableId: fx.parentTableId }),
  expectNullEntityId: true,
  skipDoubleCycle: true,
  assertExists: async (ctx, env, fx) => {
    const linked = await nestedListLinked(
      ctx,
      env,
      fx.parentTableId,
      fx.linkColumnId,
      fx.parentRow2Id,
    );
    const ids = linked.map((r: any) => String(r?.id ?? r?.Id));
    expect(ids, '[recordLinkSwapBulk] P2 has C1 after bulk paste').to.include(fx.childRow1Id);
  },
  assertGone: async (ctx, env, fx) => {
    const linked = await nestedListLinked(
      ctx,
      env,
      fx.parentTableId,
      fx.linkColumnId,
      fx.parentRow2Id,
    );
    const ids = linked.map((r: any) => String(r?.id ?? r?.Id));
    expect(ids, '[recordLinkSwapBulk] P2 unlinked after undo').to.not.include(fx.childRow1Id);
  },
};

export const recordLinkByDisplaySpec: RoundTripSpec<LinkFx> = {
  forward_op: 'recordLinkByDisplay',
  setup: setupTwoTablesWithMmLink,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      {
        operation: 'nestedDataBulkLinkByDisplayValue',
        tableId: fx.parentTableId,
      },
      [
        {
          columnId: fx.linkColumnId,
          rowId: fx.parentRow2Id,
          // Service expects `displayValues` (not `values`) — see
          // `data-table.service.ts:1132` — array of PV strings the
          // backend resolves to child pks. We pass C1's title.
          displayValues: ['C1'],
        },
      ],
    ),
  entityId: (_r, fx) => fx.parentRow2Id,
  scope: (env, fx) => tableScope(env, { tableId: fx.parentTableId }),
  expectNullEntityId: true,
  skipDoubleCycle: true,
  assertExists: async (ctx, env, fx) => {
    const linked = await nestedListLinked(
      ctx,
      env,
      fx.parentTableId,
      fx.linkColumnId,
      fx.parentRow2Id,
    );
    const ids = linked.map((r: any) => String(r?.id ?? r?.Id));
    expect(ids, '[recordLinkByDisplay] P2 has C1 after byDisplay').to.include(fx.childRow1Id);
  },
  assertGone: async (ctx, env, fx) => {
    const linked = await nestedListLinked(
      ctx,
      env,
      fx.parentTableId,
      fx.linkColumnId,
      fx.parentRow2Id,
    );
    const ids = linked.map((r: any) => String(r?.id ?? r?.Id));
    expect(ids, '[recordLinkByDisplay] P2 unlinked after undo').to.not.include(fx.childRow1Id);
  },
};

export const recordLinkSpecs: RoundTripSpec<any>[] = [
  recordLinkAddSpec,
  recordLinkRemoveSpec,
  recordLinkSwapSpec,
  recordLinkSwapBulkSpec,
  recordLinkByDisplaySpec,
];
