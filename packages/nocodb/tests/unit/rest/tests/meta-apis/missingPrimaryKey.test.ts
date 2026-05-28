import 'mocha';
import request from 'supertest';
import { expect } from 'chai';
import { UITypes } from 'nocodb-sdk';
import { Column } from '~/models';
import { createProject } from '../../../factory/base';
import { createTable } from '../../../factory/table';
import { createRow } from '../../../factory/row';
import init from '../../../init';
import type { Base, Model } from '~/models';

/**
 * Integration coverage for the no-PK family fixes in PR #9033.
 *
 * Customers with external PG/MySQL schemas that declare uniqueness via
 * `UNIQUE NOT NULL` instead of `PRIMARY KEY` get tables imported into
 * NocoDB with no column flagged `pk:true`. The downstream code that
 * dereferences `model.primaryKey.<x>` (BT/OO nested-record JSON, the
 * delByPk LMT broadcast, etc.) then crashes. These tests pin the
 * customer-facing guards:
 *
 *   - createLTARColumn rejects with 400 when either side has no PK
 *     (commit 9a092aa).
 *   - delByPk completes successfully when a related table loses its PK
 *     after the LTAR was already created (commit 8b934f3).
 *
 * Each test creates two NocoDB-managed tables (both initially have a
 * synthetic PK), then simulates the broken state by flipping `pk:false`
 * on one of them via `Column.update` — the same state a customer ends
 * up in after meta-syncing a PK-less external schema.
 */
export default function missingPrimaryKeyTests() {
  describe('No-PK LTAR guards', function () {
    let context: Awaited<ReturnType<typeof init>>;
    let base: Base;
    let tableA: Model;
    let tableB: Model;
    let ctx: { workspace_id: string; base_id: string };

    beforeEach(async function () {
      context = await init();
      base = await createProject(context);
      tableA = await createTable(context, base, {
        table_name: 'tableA',
        title: 'tableA',
      });
      tableB = await createTable(context, base, {
        table_name: 'tableB',
        title: 'tableB',
      });
      ctx = {
        workspace_id: base.fk_workspace_id,
        base_id: base.id,
      };
    });

    /** Unset `pk:true` on the table's existing PK column. */
    async function unsetPk(table: Model) {
      const cols = await table.getColumns(ctx);
      const pk = cols.find((c) => c.pk);
      if (!pk) throw new Error(`expected ${table.title} to have a PK column`);
      await Column.update(ctx, pk.id, { ...pk, pk: false } as any);
    }

    async function postLtar(
      hostTable: Model,
      target: Model,
      titleSuffix = 'link',
    ) {
      return request(context.app)
        .post(`/api/v1/db/meta/tables/${hostTable.id}/columns`)
        .set('xc-auth', context.token)
        .send({
          title: `${target.title}_${titleSuffix}`,
          column_name: `${target.title}_${titleSuffix}`,
          uidt: UITypes.Links,
          parentId: hostTable.id,
          childId: target.id,
          type: 'hm',
        });
    }

    describe('createLTARColumn rejection', function () {
      it('rejects HM creation when the parent (host) table has no primary key', async function () {
        await unsetPk(tableA);

        const res = await postLtar(tableA, tableB);

        expect(res.status).to.equal(400);
        expect(res.body.msg).to.contain('primary key');
        expect(res.body.msg).to.contain(tableA.title);
      });

      it('rejects HM creation when the child (target) table has no primary key', async function () {
        await unsetPk(tableB);

        const res = await postLtar(tableA, tableB);

        expect(res.status).to.equal(400);
        expect(res.body.msg).to.contain('primary key');
        expect(res.body.msg).to.contain(tableB.title);
      });

      it('succeeds when both sides have primary keys (positive control)', async function () {
        const res = await postLtar(tableA, tableB);

        expect(res.status).to.equal(200);
      });
    });

    describe('delByPk on a host whose related table loses its PK', function () {
      it('completes the delete instead of 500ing on undefined.column_name', async function () {
        // Create the LTAR while both sides still have PKs — meta-sync
        // prevention guards aren't in play yet because we're at the API
        // level and both tables are valid at this moment.
        const ltarRes = await postLtar(tableA, tableB);
        expect(ltarRes.status).to.equal(200);

        // Seed a row in tableA so there's something to delete.
        const row = await createRow(context, { base, table: tableA });
        expect(row.Id).to.exist;

        // Now break tableB's PK — simulates a customer-state where meta
        // metadata went out of sync (or was edited) after the LTAR was
        // created.
        await unsetPk(tableB);

        // The delete must succeed. Before commit 8b934f3 this 500ed with
        // `Cannot read properties of undefined (reading 'column_name')`.
        const delRes = await request(context.app)
          .delete(`/api/v1/db/data/noco/${base.id}/${tableA.id}/${row.Id}`)
          .set('xc-auth', context.token);

        expect(delRes.status).to.equal(200);

        // Sanity: the row really is gone.
        const listRes = await request(context.app)
          .get(`/api/v1/db/data/noco/${base.id}/${tableA.id}`)
          .set('xc-auth', context.token);
        expect(listRes.status).to.equal(200);
        expect(listRes.body.list.map((r: any) => r.Id)).to.not.include(row.Id);
      });
    });
  });
}
