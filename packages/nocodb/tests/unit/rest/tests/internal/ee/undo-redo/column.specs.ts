import { expect } from 'chai';
import request from 'supertest';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { internalPost, readColumns } from '~test/factory/internal';
import { createTable, v3Delete, v3Patch, v3Post } from '~test/factory/v3';
import { colExists, tableScope } from '~test/rest/tests/internal/ee/undo-redo/shared';
import { Column } from '~/models';

/** Read a column's `colOptions.type` (e.g. 'hm' / 'bt' / 'mm') via the model
 *  layer — `readColumns` returns columns whose colOptions may be lazy. */
async function readColOptionsType(
  env: TestEnv,
  colId: string,
): Promise<string | undefined> {
  const mctx = { workspace_id: env.workspaceId, base_id: env.baseId } as any;
  const col = await Column.get(mctx, { colId });
  if (!col) return undefined;
  const co = await col.getColOptions(mctx);
  return (co as { type?: string } | undefined)?.type;
}

interface ColFx {
  tableId: string;
  titleColId: string;
}

async function setupTableForCol(ctx: Context, env: TestEnv): Promise<ColFx> {
  const t = await createTable(ctx, env, `cTbl_${Date.now()}`);
  return { tableId: t.id, titleColId: t.titleColId };
}

export const columnAddSpec: RoundTripSpec<ColFx> = {
  forward_op: 'columnAdd',
  setup: setupTableForCol,
  // The internal `columnAdd` returns the parent **Model** (V1 default
  // shape) — `r.body.id` would be the table id, not the column id, so the
  // round-trip asserts would look for the wrong entity. v3 REST returns
  // the **Column** directly (`columnsService.columnAdd<NcApiVersion.V3>`),
  // which is what `entityId` needs. Both routes call the same service
  // method carrying @TraceCommand(columnAdd).
  forward: (ctx, env, fx) =>
    v3Post(
      ctx,
      `/api/v3/meta/bases/${env.baseId}/tables/${fx.tableId}/fields`,
      { title: 'NewCol', type: 'SingleLineText' }
    ),
  entityId: (r) => r.body.id,
  scope: tableScope,
  assertExists: async (ctx, env, fx, id) => {
    expect(await colExists(env, fx.tableId, id)).to.equal(true);
  },
  assertGone: async (ctx, env, fx, id) => {
    expect(await colExists(env, fx.tableId, id)).to.equal(false);
  },
};

interface ColUpdateFx extends ColFx {
  newColId: string;
}

async function setupExistingCol(
  ctx: Context,
  env: TestEnv,
): Promise<ColUpdateFx> {
  const base = await setupTableForCol(ctx, env);
  const added = await v3Post(
    ctx,
    `/api/v3/meta/bases/${env.baseId}/tables/${base.tableId}/fields`,
    { title: 'OriginalCol', type: 'SingleLineText' },
  );
  return { ...base, newColId: added.body.id };
}

export const columnUpdateSpec: RoundTripSpec<ColUpdateFx> = {
  forward_op: 'columnUpdate',
  setup: setupExistingCol,
  // v3 — same reason as columnAdd: response/lookup uses column id, not table id.
  forward: (ctx, env, fx) =>
    v3Patch(
      ctx,
      `/api/v3/meta/bases/${env.baseId}/tables/${fx.tableId}/fields/${fx.newColId}`,
      { title: 'RenamedCol' }
    ),
  entityId: (_r, fx) => fx.newColId,
  scope: tableScope,
  assertExists: async (_ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    const col = cols.find((c: any) => c.id === fx.newColId);
    expect(col?.title).to.equal('RenamedCol');
  },
  assertGone: async (_ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    const col = cols.find((c: any) => c.id === fx.newColId);
    expect(col?.title).to.equal('OriginalCol');
  },
};

export const columnDeleteSpec: RoundTripSpec<ColUpdateFx> = {
  forward_op: 'columnDelete',
  forwardIsDelete: true,
  setup: setupExistingCol,
  forward: (ctx, env, fx) =>
    v3Delete(
      ctx,
      `/api/v3/meta/bases/${env.baseId}/tables/${fx.tableId}/fields/${fx.newColId}`
    ),
  entityId: (_r, fx) => fx.newColId,
  scope: tableScope,
  assertExists: async (ctx, env, fx) => {
    expect(await colExists(env, fx.tableId, fx.newColId)).to.equal(true);
  },
  assertGone: async (ctx, env, fx) => {
    expect(await colExists(env, fx.tableId, fx.newColId)).to.equal(false);
  },
};

// ── columnSetAsPrimary ────────────────────────────────────────────

interface PrimaryFx {
  tableId: string;
  newPrimaryColId: string;
  originalPrimaryColId: string;
}

async function setupTwoColumns(
  ctx: Context,
  env: TestEnv,
): Promise<PrimaryFx> {
  const t = await createTable(ctx, env, `pTbl_${Date.now()}`, [
    { title: 'Title', type: 'SingleLineText' },
    { title: 'Notes', type: 'SingleLineText' },
  ]);
  // First column is the default primary (pv=true).
  const originalPrimaryColId = t.fields.find((f: any) => f.pv)?.id ?? t.titleColId;
  const notesCol = t.fields.find((f: any) => f.title === 'Notes');
  return {
    tableId: t.id,
    newPrimaryColId: notesCol.id,
    originalPrimaryColId,
  };
}

export const columnSetAsPrimarySpec: RoundTripSpec<PrimaryFx> = {
  forward_op: 'columnSetAsPrimary',
  setup: setupTwoColumns,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      {
        operation: 'columnSetAsPrimary',
        tableId: fx.tableId,
        columnId: fx.newPrimaryColId,
      },
      {}
    ),
  entityId: (_r, fx) => fx.newPrimaryColId,
  scope: (env, fx) => [
    { type: 'table', id: fx.tableId },
    { type: 'base', id: env.baseId },
  ],
  assertExists: async (_ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    const primary = cols.find((c: any) => c.pv);
    expect(primary?.id).to.equal(fx.newPrimaryColId);
  },
  assertGone: async (_ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    const primary = cols.find((c: any) => c.pv);
    expect(primary?.id).to.equal(fx.originalPrimaryColId);
  },
};

// ── Column type conversions (text ↔ link) ─────────────────────────

interface ConvFx extends ColFx {
  targetTableId: string;
  /** The column being converted — text col for text→link, link col for link→text. */
  convColId: string;
  /** Parent row → expected joined display text (link→text data round-trip). */
  rowExpect?: Array<{ rowId: string; text: string; childNames: string[] }>;
  /** Title to read converted-cell values by (defaults to CONV_TITLE). A bt
   *  reverse column auto-names after the parent table, so its converted text
   *  column keeps that title rather than CONV_TITLE. */
  cellTitle?: string;
  /** For a bt conversion: the paired hm column's id (on the target table),
   *  asserted to be restored with its original id + type on undo. */
  pairedHmId?: string;
}

const CONV_TITLE = 'ConvCol';

function isLinkUidt(uidt?: string): boolean {
  return uidt === 'LinkToAnotherRecord' || uidt === 'Links';
}

const v3Insert = async (
  ctx: Context,
  env: TestEnv,
  tableId: string,
  fields: Record<string, any>,
): Promise<string> => {
  const r = await request(ctx.app)
    .post(`/api/v3/data/${env.baseId}/${tableId}/records`)
    .set('xc-token', ctx.xc_token)
    .send([{ fields }]);
  expect(r.status, `v3 insert: ${JSON.stringify(r.body)}`).to.eq(200);
  const row = (r.body?.records ?? r.body)[0] ?? r.body;
  return String(row?.id ?? row?.Id);
};

const linkRecords = async (
  ctx: Context,
  env: TestEnv,
  parentTableId: string,
  linkColumnId: string,
  parentRowId: string,
  childIds: string[],
): Promise<void> => {
  const r = await request(ctx.app)
    .post(
      `/api/v3/data/${env.baseId}/${parentTableId}/links/${linkColumnId}/${parentRowId}`,
    )
    .set('xc-token', ctx.xc_token)
    .send(childIds.map((id) => ({ id })));
  expect(r.status, `link records: ${JSON.stringify(r.body)}`).to.eq(200);
};

const readCellText = async (
  ctx: Context,
  env: TestEnv,
  tableId: string,
  rowId: string,
  title: string = CONV_TITLE,
): Promise<string> => {
  const r = await request(ctx.app)
    .get(`/api/v3/data/${env.baseId}/${tableId}/records/${rowId}`)
    .set('xc-token', ctx.xc_token);
  expect(r.status, `read record: ${JSON.stringify(r.body).slice(0, 200)}`).to.eq(200);
  const rec = (r.body?.records ?? [r.body])[0] ?? r.body;
  return String(rec?.fields?.[title] ?? '');
};

const readLinkedNames = async (
  ctx: Context,
  env: TestEnv,
  tableId: string,
  linkColId: string,
  rowId: string,
): Promise<string[]> => {
  const r = await request(ctx.app)
    .get(`/api/v3/data/${env.baseId}/${tableId}/links/${linkColId}/${rowId}`)
    .set('xc-token', ctx.xc_token);
  expect(r.status, `linked list: ${JSON.stringify(r.body).slice(0, 200)}`).to.eq(200);
  // Multi-target links (mm/hm) return an array under records/list; a
  // single-target link (bt/oo) returns the one linked record under `record`.
  const body = r.body ?? {};
  const recs: any[] = Array.isArray(body.records)
    ? body.records
    : Array.isArray(body.list)
    ? body.list
    : body.record
    ? [body.record]
    : Array.isArray(body)
    ? body
    : [];
  return recs
    .map((rec: any) => rec?.fields?.Title ?? rec?.Title)
    .filter((v: any) => v != null)
    .map((v: any) => String(v));
};

async function setupConvBase(
  ctx: Context,
  env: TestEnv,
): Promise<{ tableId: string; titleColId: string; targetTableId: string }> {
  const main = await createTable(ctx, env, `convMain_${Date.now()}`);
  const target = await createTable(ctx, env, `convTarget_${Date.now()}`);
  return {
    tableId: main.id,
    titleColId: main.titleColId,
    targetTableId: target.id,
  };
}

// text → link: a plain SingleLineText column converted to an mm link.
async function setupTextForConv(ctx: Context, env: TestEnv): Promise<ConvFx> {
  const base = await setupConvBase(ctx, env);
  const added = await v3Post(
    ctx,
    `/api/v3/meta/bases/${env.baseId}/tables/${base.tableId}/fields`,
    { title: CONV_TITLE, type: 'SingleLineText' },
  );
  return { ...base, convColId: added.body.id };
}

export const columnConvertTextToLinkSpec: RoundTripSpec<ConvFx> = {
  forward_op: 'columnUpdate',
  label: 'columnUpdate (SingleLineText→link conversion)',
  setup: setupTextForConv,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'columnUpdate', columnId: fx.convColId },
      {
        uidt: 'LinkToAnotherRecord',
        title: CONV_TITLE,
        parentId: fx.tableId,
        childId: fx.targetTableId,
        type: 'mm',
      },
    ),
  // entity_id recorded by the contract is `params.columnId` (the source col).
  entityId: (_r, fx) => fx.convColId,
  scope: tableScope,
  // After apply: the source col is gone, replaced by a link under the same title.
  assertExists: async (_ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    expect(cols.some((c: any) => c.id === fx.convColId)).to.equal(false);
    const conv = cols.find((c: any) => c.title === CONV_TITLE);
    expect(isLinkUidt(conv?.uidt), `converted to link (uidt=${conv?.uidt})`).to.equal(true);
  },
  // After revert: the original text col is back with its original id.
  assertGone: async (_ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    const conv = cols.find((c: any) => c.id === fx.convColId);
    expect(conv, 'text col recreated with original id').to.exist;
    expect(conv.uidt).to.equal('SingleLineText');
    expect(conv.title).to.equal(CONV_TITLE);
  },
};

// link → text: an mm link column (WITH linked data) converted back to text.
// Seeds two parent rows linked to named children so the round-trip exercises
// the title-restore + link-backfill paths (which 0-row coverage missed).
async function setupLinkForConv(ctx: Context, env: TestEnv): Promise<ConvFx> {
  const base = await setupConvBase(ctx, env);

  // Children with distinct display values (Title is the related table's PV).
  const laptop = await v3Insert(ctx, env, base.targetTableId, { Title: 'Laptop' });
  const novel = await v3Insert(ctx, env, base.targetTableId, { Title: 'Novel' });
  const tshirt = await v3Insert(ctx, env, base.targetTableId, { Title: 'T-Shirt' });

  const electronics = await v3Insert(ctx, env, base.tableId, { Title: 'Electronics' });
  const books = await v3Insert(ctx, env, base.tableId, { Title: 'Books' });

  const added = await v3Post(
    ctx,
    `/api/v3/meta/bases/${env.baseId}/tables/${base.tableId}/fields`,
    { title: CONV_TITLE, type: 'SingleLineText' },
  );
  // Convert it to an mm link (untraced — setup must not touch the undo stack).
  await internalPost(
    ctx,
    env,
    { operation: 'columnUpdate', columnId: added.body.id },
    {
      uidt: 'LinkToAnotherRecord',
      title: CONV_TITLE,
      parentId: base.tableId,
      childId: base.targetTableId,
      type: 'mm',
    },
  );
  const cols = await readColumns(env, base.tableId);
  const linkCol = cols.find((c: any) => c.title === CONV_TITLE && isLinkUidt(c.uidt));
  expect(linkCol, 'link column created in setup').to.exist;

  await linkRecords(ctx, env, base.tableId, linkCol.id, electronics, [laptop, novel]);
  await linkRecords(ctx, env, base.tableId, linkCol.id, books, [tshirt]);

  return {
    ...base,
    convColId: linkCol.id,
    rowExpect: [
      { rowId: electronics, text: 'Laptop,Novel', childNames: ['Laptop', 'Novel'] },
      { rowId: books, text: 'T-Shirt', childNames: ['T-Shirt'] },
    ],
  };
}

export const columnConvertLinkToTextSpec: RoundTripSpec<ConvFx> = {
  forward_op: 'columnUpdate',
  label: 'columnUpdate (link→SingleLineText conversion)',
  setup: setupLinkForConv,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'columnUpdate', columnId: fx.convColId },
      { uidt: 'SingleLineText', title: CONV_TITLE },
    ),
  // entity_id recorded by the contract is `params.columnId` (the link col).
  entityId: (_r, fx) => fx.convColId,
  scope: tableScope,
  // After apply: the link col is gone, replaced by a text col under the same
  // title, and each row's cell holds its joined display values.
  assertExists: async (ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    expect(cols.some((c: any) => c.id === fx.convColId)).to.equal(false);
    const conv = cols.find((c: any) => c.title === CONV_TITLE);
    expect(conv?.uidt, `converted to text (uidt=${conv?.uidt})`).to.equal('SingleLineText');
    for (const { rowId, childNames } of fx.rowExpect ?? []) {
      const text = await readCellText(ctx, env, fx.tableId, rowId);
      const got = text.split(',').filter(Boolean).sort();
      expect(got, `row ${rowId} joined text`).to.deep.equal([...childNames].sort());
    }
  },
  // After revert: the link col is back with its original id AND title, and the
  // links are restored by resolving the joined text back to records.
  assertGone: async (ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    const conv = cols.find((c: any) => c.id === fx.convColId);
    expect(conv, 'link col recreated with original id').to.exist;
    expect(isLinkUidt(conv.uidt), `recreated as link (uidt=${conv.uidt})`).to.equal(true);
    expect(conv.title, 'link title restored').to.equal(CONV_TITLE);
    for (const { rowId, childNames } of fx.rowExpect ?? []) {
      const names = await readLinkedNames(ctx, env, fx.tableId, fx.convColId, rowId);
      expect(names.sort(), `row ${rowId} relinked children`).to.deep.equal([...childNames].sort());
    }
  },
};

// ── Regression: text→link cell-data backup survives undo→redo→undo ─────
// A text column WITH values, converted to a link. The forward backs the cell
// data up; undo restores it. Regression: on redo the @TraceCommand decorator's
// on_record_failure fired under replay and dropped the freshly-created backup
// column, so the SECOND undo restored an empty column. The harness double
// cycle (…→undo→redo→undo→redo) exercises exactly that; assertGone checks the
// values are intact after every revert.
async function setupTextWithDataForConv(
  ctx: Context,
  env: TestEnv,
): Promise<ConvFx> {
  const base = await setupConvBase(ctx, env);
  // Target children whose display values match the seeded text.
  await v3Insert(ctx, env, base.targetTableId, { Title: 'Laptop' });
  await v3Insert(ctx, env, base.targetTableId, { Title: 'Novel' });
  const added = await v3Post(
    ctx,
    `/api/v3/meta/bases/${env.baseId}/tables/${base.tableId}/fields`,
    { title: CONV_TITLE, type: 'SingleLineText' },
  );
  const r1 = await v3Insert(ctx, env, base.tableId, {
    Title: 'r1',
    [CONV_TITLE]: 'Laptop',
  });
  const r2 = await v3Insert(ctx, env, base.tableId, {
    Title: 'r2',
    [CONV_TITLE]: 'Novel',
  });
  return {
    ...base,
    convColId: added.body.id,
    rowExpect: [
      { rowId: r1, text: 'Laptop', childNames: ['Laptop'] },
      { rowId: r2, text: 'Novel', childNames: ['Novel'] },
    ],
  };
}

export const columnConvertTextToLinkWithDataSpec: RoundTripSpec<ConvFx> = {
  forward_op: 'columnUpdate',
  label:
    'columnUpdate (text→link — cell-data backup survives undo→redo→undo)',
  setup: setupTextWithDataForConv,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'columnUpdate', columnId: fx.convColId },
      {
        uidt: 'LinkToAnotherRecord',
        title: CONV_TITLE,
        parentId: fx.tableId,
        childId: fx.targetTableId,
        type: 'mm',
      },
    ),
  entityId: (_r, fx) => fx.convColId,
  scope: tableScope,
  assertExists: async (_ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    expect(cols.some((c: any) => c.id === fx.convColId)).to.equal(false);
    const conv = cols.find((c: any) => c.title === CONV_TITLE);
    expect(isLinkUidt(conv?.uidt), `converted to link (uidt=${conv?.uidt})`).to.equal(true);
  },
  assertGone: async (ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    const conv = cols.find((c: any) => c.id === fx.convColId);
    expect(conv, 'text col recreated with original id').to.exist;
    expect(conv.uidt).to.equal('SingleLineText');
    // The crux: original text must survive the redo cycle, not be emptied.
    for (const { rowId, text } of fx.rowExpect ?? []) {
      const got = await readCellText(ctx, env, fx.tableId, rowId);
      expect(got, `row ${rowId} text restored after revert`).to.equal(text);
    }
  },
};

// ── Regression: text→link + rename in one PATCH still records an undo row ──
// The forward both renames (body title ≠ current title) AND converts. The
// inverse used to locate the new link column by the *request* title; the
// forward actually renames it to the source's *current* title, so the lookup
// missed → inverse returned null → no undo row → backup dropped → data lost.
// The harness's "latest active log row expected" assertion fails if no undo
// row is recorded, so this spec guards the regression directly.
const P02_ORIG = 'P02Orig';
const P02_RENAMED = 'P02Renamed';

async function setupTextRenameForConv(
  ctx: Context,
  env: TestEnv,
): Promise<ConvFx> {
  const base = await setupConvBase(ctx, env);
  const added = await v3Post(
    ctx,
    `/api/v3/meta/bases/${env.baseId}/tables/${base.tableId}/fields`,
    { title: P02_ORIG, type: 'SingleLineText' },
  );
  return { ...base, convColId: added.body.id };
}

export const columnConvertTextToLinkRenameSpec: RoundTripSpec<ConvFx> = {
  forward_op: 'columnUpdate',
  label:
    'columnUpdate (text→link + rename in one PATCH — undo row still recorded)',
  setup: setupTextRenameForConv,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'columnUpdate', columnId: fx.convColId },
      {
        uidt: 'LinkToAnotherRecord',
        title: P02_RENAMED, // ← differs from the column's current title
        parentId: fx.tableId,
        childId: fx.targetTableId,
        type: 'mm',
      },
    ),
  entityId: (_r, fx) => fx.convColId,
  scope: tableScope,
  assertExists: async (_ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    expect(cols.some((c: any) => c.id === fx.convColId), 'source text col replaced').to.equal(false);
    expect(cols.some((c: any) => isLinkUidt(c.uidt)), 'a link col exists after convert').to.equal(true);
  },
  assertGone: async (_ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    const conv = cols.find((c: any) => c.id === fx.convColId);
    expect(conv, 'text col recreated with original id on undo').to.exist;
    expect(conv.uidt).to.equal('SingleLineText');
    expect(conv.title, 'original title restored').to.equal(P02_ORIG);
  },
};

// ── Regression: junction-less bt→text (P0-1) + faithful hm/bt pair undo ────
// A V1 `hm` link target→main auto-creates a junction-less `bt` reverse on
// main. Converting that bt→text (1) must read linked rows via btRead, not
// mmRead, or every cell comes out empty (P0-1); and (2) undo must restore the
// WHOLE hm/bt pair with original ids + correct relation types and re-resolve
// the links (regression: it recreated the bt as type 'hm' and dropped a link).
async function setupBtLinkForConv(
  ctx: Context,
  env: TestEnv,
): Promise<ConvFx> {
  const base = await setupConvBase(ctx, env);
  const apple = await v3Insert(ctx, env, base.targetTableId, { Title: 'Apple' });
  const banana = await v3Insert(ctx, env, base.targetTableId, { Title: 'Banana' });
  const c1 = await v3Insert(ctx, env, base.tableId, { Title: 'c1' });
  const c2 = await v3Insert(ctx, env, base.tableId, { Title: 'c2' });
  const c3 = await v3Insert(ctx, env, base.tableId, { Title: 'c3' });

  // V1 hm link target(parent) → main(child); the bt reverse lands on main.
  const hmAdd = await internalPost(
    ctx,
    env,
    { operation: 'columnAdd', tableId: base.targetTableId },
    {
      uidt: 'LinkToAnotherRecord',
      title: 'Kids',
      parentId: base.targetTableId,
      childId: base.tableId,
      type: 'hm',
    },
  );
  expect(hmAdd.status, `hm columnAdd: ${JSON.stringify(hmAdd.body)}`).to.eq(200);

  const hmCol = (await readColumns(env, base.targetTableId)).find((c: any) =>
    isLinkUidt(c.uidt),
  );
  const btCol = (await readColumns(env, base.tableId)).find((c: any) =>
    isLinkUidt(c.uidt),
  );
  expect(hmCol, 'hm col on target').to.exist;
  expect(btCol, 'bt reverse col on main').to.exist;

  // Apple ← c1,c2 ; Banana ← c3 (so the bt side is c1→Apple, c2→Apple, c3→Banana)
  await linkRecords(ctx, env, base.targetTableId, hmCol.id, apple, [c1, c2]);
  await linkRecords(ctx, env, base.targetTableId, hmCol.id, banana, [c3]);

  return {
    ...base,
    convColId: btCol.id,
    cellTitle: btCol.title, // bt auto-names after the parent table
    pairedHmId: hmCol.id,
    rowExpect: [
      { rowId: c1, text: 'Apple', childNames: ['Apple'] },
      { rowId: c2, text: 'Apple', childNames: ['Apple'] },
      { rowId: c3, text: 'Banana', childNames: ['Banana'] },
    ],
  };
}

export const columnConvertBtToTextSpec: RoundTripSpec<ConvFx> = {
  forward_op: 'columnUpdate',
  label:
    'columnUpdate (junction-less bt→text — data preserved + faithful pair restore)',
  setup: setupBtLinkForConv,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'columnUpdate', columnId: fx.convColId },
      { uidt: 'SingleLineText', title: CONV_TITLE },
    ),
  entityId: (_r, fx) => fx.convColId,
  scope: tableScope,
  // After apply: bt col gone, replaced by a text col holding each child's
  // parent display value (empty here would be the P0-1 mmRead regression).
  assertExists: async (ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    expect(cols.some((c: any) => c.id === fx.convColId), 'bt col replaced').to.equal(false);
    const conv = cols.find((c: any) => c.title === fx.cellTitle);
    expect(conv?.uidt, `converted to text (uidt=${conv?.uidt})`).to.equal('SingleLineText');
    for (const { rowId, text } of fx.rowExpect ?? []) {
      const got = await readCellText(ctx, env, fx.tableId, rowId, fx.cellTitle);
      expect(got, `row ${rowId} parent display text`).to.equal(text);
    }
  },
  // After undo: the whole hm/bt pair is back with ORIGINAL ids + correct
  // relation types, links re-resolved.
  assertGone: async (ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    const bt = cols.find((c: any) => c.id === fx.convColId);
    expect(bt, 'bt col recreated with original id').to.exist;
    expect(isLinkUidt(bt.uidt), `recreated as link (uidt=${bt.uidt})`).to.equal(true);
    expect(await readColOptionsType(env, fx.convColId), 'restored as bt').to.equal('bt');
    if (fx.pairedHmId) {
      expect(
        await readColOptionsType(env, fx.pairedHmId),
        'paired hm restored with original id',
      ).to.equal('hm');
    }
    for (const { rowId, childNames } of fx.rowExpect ?? []) {
      const names = await readLinkedNames(ctx, env, fx.tableId, fx.convColId, rowId);
      expect(names.sort(), `row ${rowId} relinked parent`).to.deep.equal([...childNames].sort());
    }
  },
};

// ── Regression: junction-less V1 oo PRIMARY (has-one) → text + undo ───────
// A V1 oo pair: the PRIMARY side has no FK on its own table (the FK lives on
// the related table). Converting it→text must read the linked record via
// hmList, not btRead — btRead reads the wrong row (it assumes a local FK), so
// the cell came out as the row's own value and the undo couldn't re-resolve
// the link. assertExists checks the related display value; assertGone checks
// the oo column is restored with original id + type and the link re-resolved.
async function setupOoPrimaryForConv(
  ctx: Context,
  env: TestEnv,
): Promise<ConvFx> {
  const base = await setupConvBase(ctx, env);
  const a1 = await v3Insert(ctx, env, base.tableId, { Title: 'a1' });
  const b1 = await v3Insert(ctx, env, base.targetTableId, { Title: 'b1' });
  // V1 oo (uidt 'Links' + type 'oo'): primary on main, reverse on target.
  const ooAdd = await internalPost(
    ctx,
    env,
    { operation: 'columnAdd', tableId: base.tableId },
    {
      uidt: 'Links',
      title: 'Partner',
      parentId: base.tableId,
      childId: base.targetTableId,
      type: 'oo',
    },
  );
  expect(ooAdd.status, `oo columnAdd: ${JSON.stringify(ooAdd.body)}`).to.eq(200);
  const primary = (await readColumns(env, base.tableId)).find((c: any) =>
    isLinkUidt(c.uidt),
  );
  expect(primary, 'primary oo on main').to.exist;
  await linkRecords(ctx, env, base.tableId, primary.id, a1, [b1]);
  return {
    ...base,
    convColId: primary.id,
    cellTitle: primary.title,
    rowExpect: [{ rowId: a1, text: 'b1', childNames: ['b1'] }],
  };
}

export const columnConvertOoPrimaryToTextSpec: RoundTripSpec<ConvFx> = {
  forward_op: 'columnUpdate',
  label:
    'columnUpdate (junction-less oo primary→text — has-one read + relinked on undo)',
  setup: setupOoPrimaryForConv,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'columnUpdate', columnId: fx.convColId },
      { uidt: 'SingleLineText', title: CONV_TITLE },
    ),
  entityId: (_r, fx) => fx.convColId,
  scope: tableScope,
  assertExists: async (ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    expect(cols.some((c: any) => c.id === fx.convColId), 'oo col replaced').to.equal(false);
    const conv = cols.find((c: any) => c.title === fx.cellTitle);
    expect(conv?.uidt, `converted to text (uidt=${conv?.uidt})`).to.equal('SingleLineText');
    for (const { rowId, text } of fx.rowExpect ?? []) {
      const got = await readCellText(ctx, env, fx.tableId, rowId, fx.cellTitle);
      expect(got, `row ${rowId} related display text`).to.equal(text);
    }
  },
  assertGone: async (ctx, env, fx) => {
    const cols = await readColumns(env, fx.tableId);
    const oo = cols.find((c: any) => c.id === fx.convColId);
    expect(oo, 'oo col recreated with original id').to.exist;
    expect(isLinkUidt(oo.uidt), `recreated as link (uidt=${oo.uidt})`).to.equal(true);
    expect(await readColOptionsType(env, fx.convColId), 'restored as oo').to.equal('oo');
    for (const { rowId, childNames } of fx.rowExpect ?? []) {
      const names = await readLinkedNames(ctx, env, fx.tableId, fx.convColId, rowId);
      expect(names.sort(), `row ${rowId} relinked`).to.deep.equal([...childNames].sort());
    }
  },
};

export const columnSpecs: RoundTripSpec<any>[] = [
  columnAddSpec,
  columnUpdateSpec,
  columnDeleteSpec,
  columnSetAsPrimarySpec,
  columnConvertTextToLinkSpec,
  columnConvertLinkToTextSpec,
  columnConvertTextToLinkWithDataSpec,
  columnConvertTextToLinkRenameSpec,
  columnConvertBtToTextSpec,
  columnConvertOoPrimaryToTextSpec,
];
