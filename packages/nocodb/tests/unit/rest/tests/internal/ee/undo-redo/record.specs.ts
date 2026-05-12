import { expect } from 'chai';
import request from 'supertest';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { createTable } from '~test/factory/v3';
import { internalPost } from '~test/factory/internal';
import { tableScope } from '~test/rest/tests/internal/ee/undo-redo/shared';

/**
 * Record CRUD ops have a different shape than meta ops:
 *
 *  - The forward op records to `nc_operation_logs` only (sandbox: false
 *    on these contracts — record mutations don't flow through sandbox).
 *  - Inverse ops have explicit `*Undo` siblings (recordInsertUndo,
 *    recordDeleteUndo, recordBulkUpsertUndo, etc.) registered in the
 *    `records` operations module.
 *  - `assertExists`/`assertGone` check row presence by primary key.
 *  - `entityId` is the row's primary-key value (composite-pk tables join
 *    with `___`, but here we use single-pk tables for simplicity).
 */

const v3DataRecord = (
  ctx: Context,
  baseId: string,
  tableId: string,
  body: any,
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
): request.Test => {
  const url = `/api/v3/data/${baseId}/${tableId}/records`;
  const req = (request(ctx.app) as any)[method.toLowerCase()](url)
    .set('xc-token', ctx.xc_token)
    .set('x-nc-tab-id', ctx.tabId ?? '');
  return body ? req.send(body) : req;
};

const v3DataList = async (
  ctx: Context,
  baseId: string,
  tableId: string,
): Promise<any[]> => {
  const r = await request(ctx.app)
    .get(`/api/v3/data/${baseId}/${tableId}/records`)
    .set('xc-token', ctx.xc_token);
  return r.body?.records ?? r.body?.list ?? [];
};

interface DataFx {
  tableId: string;
  titleColId: string;
  // For update/delete specs — pre-existing record's id and value
  existingId?: string;
  originalTitle?: string;
}

async function setupTableForData(ctx: Context, env: TestEnv): Promise<DataFx> {
  const t = await createTable(ctx, env, `dtbl_${Date.now()}`);
  return { tableId: t.id, titleColId: t.titleColId };
}

async function setupTableWithRecord(
  ctx: Context,
  env: TestEnv,
): Promise<DataFx> {
  const base = await setupTableForData(ctx, env);
  const create = await v3DataRecord(
    ctx,
    env.baseId,
    base.tableId,
    { fields: { Title: 'OriginalValue' } },
    'POST',
  );
  expect(create.status).to.eq(200);
  const created = (create.body?.records ?? create.body)[0] ?? create.body;
  const id = created?.id ?? created?.Id;
  return { ...base, existingId: String(id), originalTitle: 'OriginalValue' };
}

// ── recordInsert ──────────────────────────────────────────────────
//
// The V3 data controller always dispatches `recordBulkInsert` (even for a
// single-object body — the controller normalises to array internally
// before the @TraceCommand fires). Spec asserts the bulk forward_op.

export const recordInsertSpec: RoundTripSpec<DataFx> = {
  forward_op: 'recordBulkInsert',
  setup: setupTableForData,
  forward: (ctx, env, fx) =>
    v3DataRecord(
      ctx,
      env.baseId,
      fx.tableId,
      { fields: { Title: 'InsertedValue' } },
      'POST',
    ),
  entityId: (r) => {
    const created = (r.body?.records ?? r.body)[0] ?? r.body;
    return String(created?.id ?? created?.Id);
  },
  scope: tableScope,
  // Bulk inserts persist null entity_id on the log row.
  expectNullEntityId: true,
  assertExists: async (ctx, env, fx, id) => {
    const rows = await v3DataList(ctx, env.baseId, fx.tableId);
    expect(rows.map((r: any) => String(r.id ?? r.Id))).to.include(id);
  },
  assertGone: async (ctx, env, fx, id) => {
    const rows = await v3DataList(ctx, env.baseId, fx.tableId);
    expect(rows.map((r: any) => String(r.id ?? r.Id))).to.not.include(id);
  },
};

// ── recordUpdate ──────────────────────────────────────────────────

export const recordUpdateSpec: RoundTripSpec<DataFx> = {
  forward_op: 'recordUpdate',
  setup: setupTableWithRecord,
  forward: (ctx, env, fx) =>
    v3DataRecord(
      ctx,
      env.baseId,
      fx.tableId,
      [{ id: fx.existingId, fields: { Title: 'UpdatedValue' } }],
      'PATCH',
    ),
  entityId: (_r, fx) => fx.existingId!,
  scope: tableScope,
  assertExists: async (ctx, env, fx) => {
    const rows = await v3DataList(ctx, env.baseId, fx.tableId);
    const row = rows.find(
      (r: any) => String(r.id ?? r.Id) === fx.existingId,
    );
    expect(row?.fields?.Title ?? row?.Title).to.equal('UpdatedValue');
  },
  assertGone: async (ctx, env, fx) => {
    const rows = await v3DataList(ctx, env.baseId, fx.tableId);
    const row = rows.find(
      (r: any) => String(r.id ?? r.Id) === fx.existingId,
    );
    expect(row?.fields?.Title ?? row?.Title).to.equal(fx.originalTitle);
  },
};

// ── recordDelete ──────────────────────────────────────────────────

export const recordDeleteSpec: RoundTripSpec<DataFx> = {
  forward_op: 'recordDelete',
  forwardIsDelete: true,
  setup: setupTableWithRecord,
  forward: (ctx, env, fx) =>
    v3DataRecord(
      ctx,
      env.baseId,
      fx.tableId,
      [{ id: fx.existingId }],
      'DELETE',
    ),
  entityId: (_r, fx) => fx.existingId!,
  scope: tableScope,
  assertExists: async (ctx, env, fx) => {
    const rows = await v3DataList(ctx, env.baseId, fx.tableId);
    expect(rows.map((r: any) => String(r.id ?? r.Id))).to.include(fx.existingId);
  },
  assertGone: async (ctx, env, fx) => {
    const rows = await v3DataList(ctx, env.baseId, fx.tableId);
    expect(rows.map((r: any) => String(r.id ?? r.Id))).to.not.include(fx.existingId);
  },
};

// ── recordBulkInsert ──────────────────────────────────────────────

export const recordBulkInsertSpec: RoundTripSpec<DataFx & { ids?: string[] }> = {
  forward_op: 'recordBulkInsert',
  // Bulk ops persist a `null` entity_id on the log row — the affected
  // entities (multiple records) are captured in `meta.extra.recordPrev`
  // instead of a single entity_id. Suppress the equality check.
  expectNullEntityId: true,
  setup: setupTableForData,
  forward: (ctx, env, fx) =>
    v3DataRecord(
      ctx,
      env.baseId,
      fx.tableId,
      [
        { fields: { Title: 'Bulk1' } },
        { fields: { Title: 'Bulk2' } },
        { fields: { Title: 'Bulk3' } },
      ],
      'POST',
    ),
  entityId: (r, fx) => {
    const created = r.body?.records ?? r.body;
    const ids = (created as any[]).map((c: any) => String(c.id ?? c.Id));
    fx.ids = ids;
    // Return the first id as the canonical entity_id (assertExists/Gone
    // check all of them).
    return ids[0];
  },
  scope: tableScope,
  assertExists: async (ctx, env, fx) => {
    const rows = await v3DataList(ctx, env.baseId, fx.tableId);
    const present = rows.map((r: any) => String(r.id ?? r.Id));
    for (const id of fx.ids ?? []) {
      expect(present, `bulk insert id ${id}`).to.include(id);
    }
  },
  assertGone: async (ctx, env, fx) => {
    const rows = await v3DataList(ctx, env.baseId, fx.tableId);
    const present = rows.map((r: any) => String(r.id ?? r.Id));
    for (const id of fx.ids ?? []) {
      expect(present, `bulk insert id ${id} should be gone`).to.not.include(id);
    }
  },
};

// ── Multi-row fixture (≥2 rows triggers the bulk forward_op) ─────

async function setupTableWithRows(
  ctx: Context,
  env: TestEnv,
  count = 3,
): Promise<DataFx & { ids: string[]; originals: string[] }> {
  const base = await setupTableForData(ctx, env);
  const originals = Array.from({ length: count }, (_, i) => `Orig_${i}`);
  const create = await v3DataRecord(
    ctx,
    env.baseId,
    base.tableId,
    originals.map((Title) => ({ fields: { Title } })),
    'POST',
  );
  expect(create.status).to.eq(200);
  const created = (create.body?.records ?? create.body) as any[];
  const ids = created.map((c) => String(c.id ?? c.Id));
  return { ...base, ids, originals };
}

// ── recordBulkUpdate ──────────────────────────────────────────────

export const recordBulkUpdateSpec: RoundTripSpec<
  DataFx & { ids: string[]; originals: string[] }
> = {
  forward_op: 'recordBulkUpdate',
  setup: (ctx, env) => setupTableWithRows(ctx, env),
  forward: (ctx, env, fx) =>
    v3DataRecord(
      ctx,
      env.baseId,
      fx.tableId,
      fx.ids.map((id) => ({ id, fields: { Title: 'BulkUpdated' } })),
      'PATCH',
    ),
  entityId: (_r, fx) => fx.ids[0],
  // Multi-row update routes to recordBulkUpdate; entity_id on the log row is null.
  expectNullEntityId: true,
  scope: tableScope,
  assertExists: async (ctx, env, fx) => {
    const rows = await v3DataList(ctx, env.baseId, fx.tableId);
    for (const id of fx.ids) {
      const row = rows.find((r: any) => String(r.id ?? r.Id) === id);
      expect(row?.fields?.Title ?? row?.Title, `id ${id}`).to.equal('BulkUpdated');
    }
  },
  assertGone: async (ctx, env, fx) => {
    const rows = await v3DataList(ctx, env.baseId, fx.tableId);
    fx.ids.forEach((id, i) => {
      const row = rows.find((r: any) => String(r.id ?? r.Id) === id);
      expect(row?.fields?.Title ?? row?.Title, `id ${id}`).to.equal(
        fx.originals[i],
      );
    });
  },
};

// ── recordBulkDelete ──────────────────────────────────────────────

export const recordBulkDeleteSpec: RoundTripSpec<
  DataFx & { ids: string[]; originals: string[] }
> = {
  forward_op: 'recordBulkDelete',
  forwardIsDelete: true,
  setup: (ctx, env) => setupTableWithRows(ctx, env),
  forward: (ctx, env, fx) =>
    v3DataRecord(
      ctx,
      env.baseId,
      fx.tableId,
      fx.ids.map((id) => ({ id })),
      'DELETE',
    ),
  entityId: (_r, fx) => fx.ids[0],
  expectNullEntityId: true,
  scope: tableScope,
  assertExists: async (ctx, env, fx) => {
    const rows = await v3DataList(ctx, env.baseId, fx.tableId);
    const present = rows.map((r: any) => String(r.id ?? r.Id));
    for (const id of fx.ids) {
      expect(present, `id ${id}`).to.include(id);
    }
  },
  assertGone: async (ctx, env, fx) => {
    const rows = await v3DataList(ctx, env.baseId, fx.tableId);
    const present = rows.map((r: any) => String(r.id ?? r.Id));
    for (const id of fx.ids) {
      expect(present, `id ${id}`).to.not.include(id);
    }
  },
};

// ── recordMove ────────────────────────────────────────────────────
//
// Internal API: POST /api/v2/internal/... ?operation=dataMove
//   &tableId=<id>&rowId=<row>&before=<beforeRow>
// Moves `rowId` to sit immediately before `beforeRowId`. Undo is
// recordMove with the pre-move neighbor (captured at forward time).

async function readOrder(
  ctx: Context,
  env: TestEnv,
  tableId: string,
): Promise<string[]> {
  const rows = await v3DataList(ctx, env.baseId, tableId);
  return rows.map((r: any) => String(r.id ?? r.Id));
}

export const recordMoveSpec: RoundTripSpec<
  DataFx & { ids: string[]; originals: string[]; originalOrder: string[] }
> = {
  forward_op: 'recordMove',
  setup: async (ctx, env) => {
    const fx = await setupTableWithRows(ctx, env, 3);
    const originalOrder = await readOrder(ctx, env, fx.tableId);
    return { ...fx, originalOrder };
  },
  // Move ids[0] to before ids[2] → new order [ids[1], ids[0], ids[2]].
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      {
        operation: 'dataMove',
        tableId: fx.tableId,
        rowId: fx.ids[0],
        before: fx.ids[2],
      },
      {},
    ),
  entityId: (_r, fx) => fx.ids[0],
  scope: tableScope,
  assertExists: async (ctx, env, fx) => {
    const order = await readOrder(ctx, env, fx.tableId);
    // After forward: ids[0] sits immediately before ids[2].
    const i0 = order.indexOf(fx.ids[0]);
    const i2 = order.indexOf(fx.ids[2]);
    expect(i0, 'id[0] in order').to.be.greaterThan(-1);
    expect(i2 - i0, 'id[0] right before id[2]').to.equal(1);
  },
  assertGone: async (ctx, env, fx) => {
    const order = await readOrder(ctx, env, fx.tableId);
    // After undo: original order restored.
    expect(order).to.deep.equal(fx.originalOrder);
  },
};

// ── recordBulkUpsert ──────────────────────────────────────────────
//
// Only the v1 bulk endpoint (`/api/v1/db/data/bulk/:orgs/:baseName/
// :tableName/upsert`) is @TraceCommand-decorated for `recordBulkUpsert`.
// v3's `/records/upsert` calls `baseModel.bulkUpsert` directly with no
// decorator. Use the v1 path here so the contract fires.

function v1BulkUpsert(
  ctx: Context,
  env: TestEnv,
  tableId: string,
  body: any[],
): request.Test {
  return request(ctx.app)
    .post(`/api/v1/db/data/bulk/noco/${env.baseId}/${tableId}/upsert`)
    .set('xc-token', ctx.xc_token)
    .set('x-nc-tab-id', ctx.tabId ?? '')
    .send(body);
}

export const recordBulkUpsertSpec: RoundTripSpec<
  DataFx & { ids: string[]; originals: string[] }
> = {
  forward_op: 'recordBulkUpsert',
  setup: (ctx, env) => setupTableWithRows(ctx, env, 2),
  // Two existing rows updated by id + one new row inserted (no id).
  forward: (ctx, env, fx) =>
    v1BulkUpsert(ctx, env, fx.tableId, [
      { Id: fx.ids[0], Title: 'Upserted_0' },
      { Id: fx.ids[1], Title: 'Upserted_1' },
      { Title: 'Upserted_NEW' },
    ]),
  entityId: (_r, fx) => fx.ids[0],
  expectNullEntityId: true,
  scope: tableScope,
  assertExists: async (ctx, env, fx) => {
    const rows = await v3DataList(ctx, env.baseId, fx.tableId);
    // The two pre-existing rows now carry 'Upserted_*'.
    fx.ids.forEach((id, i) => {
      const row = rows.find((r: any) => String(r.id ?? r.Id) === id);
      expect(row?.fields?.Title ?? row?.Title, `id ${id}`).to.equal(
        `Upserted_${i}`,
      );
    });
    // A third row exists with 'Upserted_NEW' (inserted, fresh id).
    const newRow = rows.find(
      (r: any) => (r.fields?.Title ?? r.Title) === 'Upserted_NEW',
    );
    expect(newRow, 'newly upserted row').to.exist;
  },
  assertGone: async (ctx, env, fx) => {
    const rows = await v3DataList(ctx, env.baseId, fx.tableId);
    // After undo: existing rows reverted to their original titles, and
    // the inserted row is gone.
    fx.ids.forEach((id, i) => {
      const row = rows.find((r: any) => String(r.id ?? r.Id) === id);
      expect(row?.fields?.Title ?? row?.Title, `id ${id}`).to.equal(
        fx.originals[i],
      );
    });
    const inserted = rows.find(
      (r: any) => (r.fields?.Title ?? r.Title) === 'Upserted_NEW',
    );
    expect(inserted, 'inserted row should be gone after undo').to.not.exist;
  },
};

export const recordSpecs: RoundTripSpec<any>[] = [
  recordInsertSpec,
  recordUpdateSpec,
  recordDeleteSpec,
  recordBulkInsertSpec,
  recordBulkUpdateSpec,
  recordBulkDeleteSpec,
  recordMoveSpec,
  recordBulkUpsertSpec,
];
