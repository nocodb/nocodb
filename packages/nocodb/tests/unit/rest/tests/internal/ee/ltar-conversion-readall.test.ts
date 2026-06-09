import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '~test/init';
import { createV3Base } from '~test/factory/base';
import { createTable } from '~test/factory/v3';
import { internalPost, readColumns } from '~test/factory/internal';

/**
 * Regression: link→text conversion must read EVERY linked child, not the first
 * 25. A junction-less has-many (`hm`) link reads its children via `hmList`,
 * which defaults to a 25-row limit; the conversion now passes `selectAllRecords`
 * so a parent row with >25 children keeps all of them in the joined text.
 * Pre-fix this silently truncated to 25 (and the loss was irreversible, since
 * undo rebuilds the link from the joined text).
 */

type Ctx = Awaited<ReturnType<typeof init>>;
interface Env {
  workspaceId: string;
  baseId: string;
}

function isLinkUidt(uidt?: string): boolean {
  return uidt === 'LinkToAnotherRecord' || uidt === 'Links';
}

async function v3Insert(
  ctx: Ctx,
  env: Env,
  tableId: string,
  fields: Record<string, any>,
): Promise<string> {
  const r = await request(ctx.app)
    .post(`/api/v3/data/${env.baseId}/${tableId}/records`)
    .set('xc-token', ctx.xc_token)
    .send([{ fields }]);
  expect(r.status, `v3 insert: ${JSON.stringify(r.body)}`).to.eq(200);
  const row = (r.body?.records ?? r.body)[0] ?? r.body;
  return String(row?.id ?? row?.Id);
}

async function linkRecords(
  ctx: Ctx,
  env: Env,
  parentTableId: string,
  linkColumnId: string,
  parentRowId: string,
  childIds: string[],
): Promise<void> {
  const r = await request(ctx.app)
    .post(
      `/api/v3/data/${env.baseId}/${parentTableId}/links/${linkColumnId}/${parentRowId}`,
    )
    .set('xc-token', ctx.xc_token)
    .send(childIds.map((id) => ({ id })));
  expect(r.status, `link records: ${JSON.stringify(r.body)}`).to.eq(200);
}

async function readCellText(
  ctx: Ctx,
  env: Env,
  tableId: string,
  rowId: string,
  title: string,
): Promise<string> {
  const r = await request(ctx.app)
    .get(`/api/v3/data/${env.baseId}/${tableId}/records/${rowId}`)
    .set('xc-token', ctx.xc_token);
  expect(
    r.status,
    `read record: ${JSON.stringify(r.body).slice(0, 200)}`,
  ).to.eq(200);
  const rec = (r.body?.records ?? [r.body])[0] ?? r.body;
  return String(rec?.fields?.[title] ?? '');
}

export function ltarConversionReadAllTests() {
  describe('LTAR conversion — reads all linked records (no 25-row cap)', () => {
    let ctx: Ctx;
    let env: Env;

    beforeEach(async () => {
      ctx = await init();
      const base = await createV3Base(ctx, `ltarRA_${Date.now()}`);
      env = { workspaceId: ctx.fk_workspace_id!, baseId: base.id };
    });

    it('has-many → text joins ALL children when a parent has >25', async function () {
      this.timeout(60000);
      const N = 30; // exceeds the historical 25-row hmList cap

      const main = await createTable(ctx, env, `mainHm_${Date.now()}`);
      const target = await createTable(ctx, env, `tgtHm_${Date.now()}`);

      // `hm` column on `main` (main has many target). Reading its children
      // routes through `hmList` — the path that used to cap at 25.
      const hmAdd = await internalPost(
        ctx,
        env,
        { operation: 'columnAdd', tableId: main.id },
        {
          uidt: 'LinkToAnotherRecord',
          title: 'Children',
          parentId: main.id,
          childId: target.id,
          type: 'hm',
        },
      );
      expect(hmAdd.status, `hm add: ${JSON.stringify(hmAdd.body)}`).to.eq(200);

      const hmCol = (await readColumns(env, main.id)).find((c: any) =>
        isLinkUidt(c.uidt),
      );
      expect(hmCol, 'hm column created on main').to.exist;

      const names: string[] = [];
      const childIds: string[] = [];
      for (let i = 0; i < N; i++) {
        const nm = `child_${String(i).padStart(2, '0')}`;
        names.push(nm);
        childIds.push(await v3Insert(ctx, env, target.id, { Title: nm }));
      }
      const parentRow = await v3Insert(ctx, env, main.id, { Title: 'parent' });
      await linkRecords(ctx, env, main.id, hmCol.id, parentRow, childIds);

      // Convert the hm link column → SingleLineText.
      const conv = await internalPost(
        ctx,
        env,
        { operation: 'columnUpdate', columnId: hmCol.id },
        { uidt: 'SingleLineText', title: 'Children' },
      );
      expect(
        conv.status,
        `convert hm→text: ${JSON.stringify(conv.body)}`,
      ).to.eq(200);

      // The joined cell must contain EVERY child — pre-fix it truncated to 25.
      const text = await readCellText(ctx, env, main.id, parentRow, 'Children');
      const got = text
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .sort();
      expect(got.length, `joined child count (got "${text}")`).to.equal(N);
      expect(got, 'all children present in joined text').to.deep.equal(
        [...names].sort(),
      );
    });
  });
}

export default ltarConversionReadAllTests;
