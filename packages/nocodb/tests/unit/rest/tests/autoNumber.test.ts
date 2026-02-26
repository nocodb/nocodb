import 'mocha';
import request from 'supertest';
import { UITypes, ViewTypes } from 'nocodb-sdk';
import { expect } from 'chai';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createColumn, deleteColumn } from '../../factory/column';
import { createTable } from '../../factory/table';
import { createView } from '../../factory/view';
import { createBulkRows, listRow } from '../../factory/row';
import { backfillAutoNumber } from '../../../../src/helpers/autonumberHelpers';
import { Column } from '../../../../src/models';
import type Model from '../../../../src/models/Model';
import type Base from '~/models/Base';

function autoNumberTests() {
  let context;
  let base: Base;
  let table: Model;
  let ctx: { workspace_id: string; base_id: string };

  beforeEach(async function () {
    context = await init();
    base = await createProject(context);
    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    table = await createTable(context, base, {
      table_name: 'autonumbertest',
      title: 'autoNumberTest',
      columns: [
        { column_name: 'Id', title: 'Id', uidt: UITypes.ID },
        {
          column_name: 'Title',
          title: 'Title',
          uidt: UITypes.SingleLineText,
        },
        { column_name: 'Amount', title: 'Amount', uidt: UITypes.Number },
      ],
    });
  });

  describe('Creation', () => {
    it('should create AutoNumber column on empty table', async () => {
      const col = await createColumn(context, table, {
        title: 'AutoNum',
        uidt: UITypes.AutoNumber,
        table_name: table.table_name,
        column_name: 'AutoNum',
      });
      expect(col).to.not.be.undefined;
      expect(col.uidt).to.eq(UITypes.AutoNumber);
      expect(col.ai).to.eq(true);
    });

    it('should backfill existing rows with sequential values', async () => {
      const rows = [];
      for (let i = 0; i < 10; i++) {
        rows.push({ Title: `Row ${i}`, Amount: (i + 1) * 10 });
      }
      await createBulkRows(context, { base, table, values: rows });

      await createColumn(context, table, {
        title: 'AutoNum',
        uidt: UITypes.AutoNumber,
        table_name: table.table_name,
        column_name: 'AutoNum',
      });

      const records = await listRow({ base, table });
      expect(records.length).to.eq(10);

      const values = records.map((r) => r.AutoNum).sort((a, b) => a - b);
      expect(values[0]).to.eq(1);
      expect(values[9]).to.eq(10);
      expect(new Set(values).size).to.eq(10);
    });
  });

  describe('Auto-increment on insert', () => {
    it('should auto-assign values to new rows', async () => {
      await createColumn(context, table, {
        title: 'AutoNum',
        uidt: UITypes.AutoNumber,
        table_name: table.table_name,
        column_name: 'AutoNum',
      });

      await createBulkRows(context, {
        base,
        table,
        values: [
          { Title: 'A', Amount: 1 },
          { Title: 'B', Amount: 2 },
          { Title: 'C', Amount: 3 },
        ],
      });

      const records = await listRow({ base, table });
      expect(records.length).to.eq(3);

      const values = records.map((r) => r.AutoNum).sort((a, b) => a - b);
      expect(values[0]).to.be.a('number');
      expect(values[0]).to.be.greaterThan(0);
      expect(values[2] - values[0]).to.eq(2);
    });

    it('should continue sequence after backfill', async () => {
      const rows = [];
      for (let i = 0; i < 5; i++) {
        rows.push({ Title: `Row ${i}`, Amount: i });
      }
      await createBulkRows(context, { base, table, values: rows });

      await createColumn(context, table, {
        title: 'AutoNum',
        uidt: UITypes.AutoNumber,
        table_name: table.table_name,
        column_name: 'AutoNum',
      });

      await createBulkRows(context, {
        base,
        table,
        values: [{ Title: 'New1' }, { Title: 'New2' }],
      });

      const records = await listRow({ base, table });
      expect(records.length).to.eq(7);

      const values = records.map((r) => r.AutoNum).sort((a, b) => a - b);
      expect(values).to.deep.eq([1, 2, 3, 4, 5, 6, 7]);
    });
  });

  describe('View-aware backfill', () => {
    // Helper: re-backfill an existing AutoNumber column with view order.
    // backfillAutoNumber uses UPDATE...SET...FROM which overwrites existing values.
    async function rebackfillWithView(
      col: Column,
      viewId: string,
    ): Promise<void> {
      const sources = await base.getSources();
      const source = sources[0];
      const freshCol = await Column.get(ctx, { colId: col.id });
      await backfillAutoNumber(ctx, table, freshCol, source, viewId);
    }

    it('should backfill with view sort order', async () => {
      await createBulkRows(context, {
        base,
        table,
        values: [
          { Title: 'C', Amount: 30 },
          { Title: 'A', Amount: 10 },
          { Title: 'B', Amount: 20 },
        ],
      });

      const col = await createColumn(context, table, {
        title: 'AutoNum',
        uidt: UITypes.AutoNumber,
        table_name: table.table_name,
        column_name: 'AutoNum',
      });

      const view = await createView(context, {
        title: 'SortedView',
        table,
        type: ViewTypes.GRID,
      });

      const columns = await table.getColumns(ctx);
      const titleCol = columns.find((c) => c.title === 'Title');

      await request(context.app)
        .post(`/api/v1/db/meta/views/${view.id}/sorts`)
        .set('xc-auth', context.token)
        .send({ fk_column_id: titleCol.id, direction: 'asc' })
        .expect(200);

      await rebackfillWithView(col, view.id);

      const records = await listRow({ base, table });
      const rowA = records.find((r) => r.Title === 'A');
      const rowB = records.find((r) => r.Title === 'B');
      const rowC = records.find((r) => r.Title === 'C');

      expect(rowA.AutoNum).to.eq(1);
      expect(rowB.AutoNum).to.eq(2);
      expect(rowC.AutoNum).to.eq(3);
    });

    it('should backfill with view filter (filtered rows first)', async () => {
      await createBulkRows(context, {
        base,
        table,
        values: [
          { Title: 'A', Amount: 100 },
          { Title: 'B', Amount: 5 },
          { Title: 'C', Amount: 200 },
          { Title: 'D', Amount: 3 },
        ],
      });

      const col = await createColumn(context, table, {
        title: 'AutoNum',
        uidt: UITypes.AutoNumber,
        table_name: table.table_name,
        column_name: 'AutoNum',
      });

      const view = await createView(context, {
        title: 'FilteredView',
        table,
        type: ViewTypes.GRID,
      });

      const columns = await table.getColumns(ctx);
      const amountCol = columns.find((c) => c.title === 'Amount');

      await request(context.app)
        .post(`/api/v1/db/meta/views/${view.id}/filters`)
        .set('xc-auth', context.token)
        .send({ fk_column_id: amountCol.id, comparison_op: 'gt', value: 10 })
        .expect(200);

      await rebackfillWithView(col, view.id);

      const records = await listRow({ base, table });
      const rowA = records.find((r) => r.Title === 'A');
      const rowC = records.find((r) => r.Title === 'C');
      const rowB = records.find((r) => r.Title === 'B');
      const rowD = records.find((r) => r.Title === 'D');

      // Filtered rows (A, C with Amount > 10) should get lower numbers
      expect(rowA.AutoNum).to.be.lessThanOrEqual(2);
      expect(rowC.AutoNum).to.be.lessThanOrEqual(2);
      // Non-filtered rows (B, D) should get higher numbers
      expect(rowB.AutoNum).to.be.greaterThan(2);
      expect(rowD.AutoNum).to.be.greaterThan(2);

      const values = records.map((r) => r.AutoNum).sort((a, b) => a - b);
      expect(values).to.deep.eq([1, 2, 3, 4]);
    });

    it('should backfill with view filter + sort', async () => {
      await createBulkRows(context, {
        base,
        table,
        values: [
          { Title: 'D', Amount: 200 },
          { Title: 'C', Amount: 50 },
          { Title: 'B', Amount: 5 },
          { Title: 'A', Amount: 100 },
        ],
      });

      const col = await createColumn(context, table, {
        title: 'AutoNum',
        uidt: UITypes.AutoNumber,
        table_name: table.table_name,
        column_name: 'AutoNum',
      });

      const view = await createView(context, {
        title: 'FilterSortView',
        table,
        type: ViewTypes.GRID,
      });

      const columns = await table.getColumns(ctx);
      const amountCol = columns.find((c) => c.title === 'Amount');
      const titleCol = columns.find((c) => c.title === 'Title');

      await request(context.app)
        .post(`/api/v1/db/meta/views/${view.id}/filters`)
        .set('xc-auth', context.token)
        .send({
          fk_column_id: amountCol.id,
          comparison_op: 'gte',
          value: 50,
        })
        .expect(200);

      await request(context.app)
        .post(`/api/v1/db/meta/views/${view.id}/sorts`)
        .set('xc-auth', context.token)
        .send({ fk_column_id: titleCol.id, direction: 'asc' })
        .expect(200);

      await rebackfillWithView(col, view.id);

      const records = await listRow({ base, table });
      const rowA = records.find((r) => r.Title === 'A');
      const rowC = records.find((r) => r.Title === 'C');
      const rowD = records.find((r) => r.Title === 'D');
      const rowB = records.find((r) => r.Title === 'B');

      // Filtered (Amount >= 50): A(100), C(50), D(200) sorted by Title ASC
      expect(rowA.AutoNum).to.eq(1);
      expect(rowC.AutoNum).to.eq(2);
      expect(rowD.AutoNum).to.eq(3);
      // Non-filtered: B(5) → 4
      expect(rowB.AutoNum).to.eq(4);
    });
  });

  describe('Type conversion', () => {
    it('should convert Number to AutoNumber', async () => {
      const numCol = await createColumn(context, table, {
        title: 'NumField',
        uidt: UITypes.Number,
        table_name: table.table_name,
        column_name: 'NumField',
      });

      await createBulkRows(context, {
        base,
        table,
        values: [
          { Title: 'A', NumField: 100 },
          { Title: 'B', NumField: 200 },
          { Title: 'C', NumField: 300 },
        ],
      });

      const res = await request(context.app)
        .patch(`/api/v2/meta/columns/${numCol.id}`)
        .set('xc-auth', context.token)
        .send({
          title: 'NumField',
          column_name: 'NumField',
          uidt: UITypes.AutoNumber,
          table_name: table.table_name,
        });

      if (res.status !== 200) {
        console.error(
          'Number->AutoNumber failed:',
          res.status,
          JSON.stringify(res.body),
        );
      }
      expect(res.status).to.eq(200);

      const columns = await table.getColumns(ctx);
      const updated = columns.find((c) => c.title === 'NumField');
      expect(updated.uidt).to.eq(UITypes.AutoNumber);

      const records = await listRow({ base, table });
      const values = records.map((r) => r.NumField).sort((a, b) => a - b);
      expect(values).to.deep.eq([1, 2, 3]);

      // New inserts should auto-increment from 4
      await createBulkRows(context, {
        base,
        table,
        values: [{ Title: 'D' }],
      });
      const allRecords = await listRow({ base, table });
      const newRow = allRecords.find((r) => r.Title === 'D');
      expect(newRow.NumField).to.eq(4);
    });

    it('should convert SingleLineText to AutoNumber', async () => {
      const textCol = await createColumn(context, table, {
        title: 'TextField',
        uidt: UITypes.SingleLineText,
        table_name: table.table_name,
        column_name: 'TextField',
      });

      await createBulkRows(context, {
        base,
        table,
        values: [{ Title: 'A', TextField: 'hello' }, { Title: 'B' }],
      });

      const res = await request(context.app)
        .patch(`/api/v2/meta/columns/${textCol.id}`)
        .set('xc-auth', context.token)
        .send({
          title: 'TextField',
          column_name: 'TextField',
          uidt: UITypes.AutoNumber,
          table_name: table.table_name,
        });

      if (res.status !== 200) {
        console.error(
          'Text->AutoNumber failed:',
          res.status,
          JSON.stringify(res.body),
        );
      }
      expect(res.status).to.eq(200);

      const columns = await table.getColumns(ctx);
      const updated = columns.find((c) => c.title === 'TextField');
      expect(updated.uidt).to.eq(UITypes.AutoNumber);

      const records = await listRow({ base, table });
      const values = records.map((r) => r.TextField).sort((a, b) => a - b);
      expect(values).to.deep.eq([1, 2]);
    });
  });

  describe('Column deletion', () => {
    it('should delete AutoNumber column', async () => {
      const column = await createColumn(context, table, {
        title: 'AutoNum',
        uidt: UITypes.AutoNumber,
        table_name: table.table_name,
        column_name: 'AutoNum',
      });

      await deleteColumn(context, { table, column });

      const columns = await table.getColumns(ctx);
      expect(columns.some((c) => c.title === 'AutoNum')).to.eq(false);
    });
  });

  describe('Read-only behavior', () => {
    it('should not allow manual update of AutoNumber values', async () => {
      await createColumn(context, table, {
        title: 'AutoNum',
        uidt: UITypes.AutoNumber,
        table_name: table.table_name,
        column_name: 'AutoNum',
      });

      await createBulkRows(context, {
        base,
        table,
        values: [{ Title: 'Test' }],
      });

      const records = await listRow({ base, table });
      const rowId = records[0].Id;
      const originalVal = records[0].AutoNum;

      await request(context.app)
        .patch(`/api/v1/db/data/noco/${base.id}/${table.id}/${rowId}`)
        .set('xc-auth', context.token)
        .send({ AutoNum: 999 });

      const updatedRecords = await listRow({ base, table });
      // Value should remain unchanged — AutoNumber is read-only
      expect(updatedRecords[0].AutoNum).to.eq(originalVal);
    });
  });
}

export default function () {
  describe('AutoNumber', autoNumberTests);
}
