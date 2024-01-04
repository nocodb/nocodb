import 'mocha';
import { title } from 'process';
import request from 'supertest';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import init from '../../init';
import { createProject, createSakilaProject } from '../../factory/base';
import {
  createColumn,
  createQrCodeColumn,
  deleteColumn,
} from '../../factory/column';
import {
  createTable,
  getColumnsByAPI,
  getTable,
  getTableByAPI,
} from '../../factory/table';
import { createBulkRows, listRow, rowMixedValue } from '../../factory/row';
import type Model from '../../../../src/models/Model';
import type Base from '~/models/Base';
import type Column from '../../../../src/models/Column';

// Test case list
// 1. Qr Code Column
// a. adding a QR code column which references another column
//   - delivers the same cell values as the referenced column
//   - gets deleted if the referenced column gets deleted

function columnTypeSpecificTests() {
  let context;
  let base: Base;
  let sakilaProject: Base;
  let customerTable: Model;
  let qrValueReferenceColumn: Column;

  const qrValueReferenceColumnTitle = 'Qr Value Column';
  const qrCodeReferenceColumnTitle = 'Qr Code Column';

  describe('Qr Code Column', () => {
    beforeEach(async function () {
      console.time('#### columnTypeSpecificTests');
      context = await init(true);

      sakilaProject = await createSakilaProject(context);
      base = await createProject(context);

      customerTable = await getTable({
        base: sakilaProject,
        name: 'customer',
      });

      qrValueReferenceColumn = await createColumn(context, customerTable, {
        title: qrValueReferenceColumnTitle,
        uidt: UITypes.SingleLineText,
        table_name: customerTable.table_name,
        column_name: qrValueReferenceColumnTitle,
      });

      await createQrCodeColumn(context, {
        title: qrCodeReferenceColumnTitle,
        table: customerTable,
        referencedQrValueTableColumnTitle: qrValueReferenceColumnTitle,
      });
      console.timeEnd('#### columnTypeSpecificTests');
    });

    it('delivers the same cell values as the referenced column', async () => {
      const resp = await request(context.app)
        .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
        .set('xc-auth', context.token)
        .expect(200);
      expect(resp.body.list[0][qrValueReferenceColumnTitle]).to.eql(
        resp.body.list[0][qrCodeReferenceColumnTitle],
      );
      expect(
        resp.body.list.map((row) => row[qrValueReferenceColumnTitle]),
      ).to.eql(resp.body.list.map((row) => row[qrCodeReferenceColumnTitle]));
    });

    it('gets deleted if the referenced column gets deleted', async () => {
      // delete referenced value column
      const columnsBeforeReferencedColumnDeleted =
        await customerTable.getColumns();

      expect(
        columnsBeforeReferencedColumnDeleted.some(
          (col) => col['title'] === qrCodeReferenceColumnTitle,
        ),
      ).to.eq(true);

      const response = await request(context.app)
        .delete(`/api/v1/db/meta/columns/${qrValueReferenceColumn.id}`)
        .set('xc-auth', context.token)
        .send({});

      const columnsAfterReferencedColumnDeleted =
        await customerTable.getColumns();
      expect(
        columnsAfterReferencedColumnDeleted.some(
          (col) => col['title'] === qrCodeReferenceColumnTitle,
        ),
      ).to.eq(false);
    });
  });

  // Created-at, Last-modified-at field

  let table: Model;
  let columns: any[];
  let unfilteredRecords: any[] = [];

  describe('CreatedAt, LastModifiedAt Field', () => {
    beforeEach(async function () {
      context = await init();
      base = await createProject(context);
      table = await createTable(context, base, {
        table_name: 'dateBased',
        title: 'dateBased',
        columns: [
          {
            column_name: 'Id',
            title: 'Id',
            uidt: UITypes.ID,
          },
          {
            column_name: 'DateField',
            title: 'DateField',
            uidt: UITypes.Date,
          },
        ],
      });

      columns = await table.getColumns();

      const rowAttributes = [];
      for (let i = 0; i < 100; i++) {
        const row = {
          DateField: rowMixedValue(columns[1], i),
        };
        rowAttributes.push(row);
      }

      await createBulkRows(context, {
        base,
        table,
        values: rowAttributes,
      });
      unfilteredRecords = await listRow({ base, table });

      // verify length of unfiltered records to be 800
      expect(unfilteredRecords.length).to.equal(100);
    });

    describe('Basic verification', async () => {
      it('New table: verify system fields are added by default', async () => {
        // Id, Date, CreatedAt, LastModifiedAt
        expect(columns.length).to.equal(4);
        expect(columns[2].title).to.equal('CreatedAt');
        expect(columns[2].uidt).to.equal(UITypes.CreatedTime);
        expect(columns[2].system).to.equal(true);
        expect(columns[3].title).to.equal('UpdatedAt');
        expect(columns[3].uidt).to.equal(UITypes.LastModifiedTime);
        expect(columns[3].system).to.equal(true);
      });

      it('New table: should not be able to delete system fields', async () => {
        await request(context.app)
          .delete(`/api/v2/meta/columns/${columns[2].id}`)
          .set('xc-auth', context.token)
          .send({})
          .expect(400);

        await request(context.app)
          .delete(`/api/v2/meta/columns/${columns[3].id}`)
          .set('xc-auth', context.token)
          .send({})
          .expect(400);

        // try to delete system fields (using v1 api)
        await request(context.app)
          .delete(`/api/v1/db/meta/columns/${columns[2].id}`)
          .set('xc-auth', context.token)
          .send({})
          .expect(400);
        await request(context.app)
          .delete(`/api/v1/db/meta/columns/${columns[3].id}`)
          .set('xc-auth', context.token)
          .send({})
          .expect(400);
      });

      it('New record: verify created-at is filled with current dateTime, last-modified-at is null', async () => {
        // get current date time
        const currentDateTime = new Date();
        const storedDateTime = new Date(unfilteredRecords[0].CreatedAt);

        // calculate difference between current date time and stored date time
        const difference = currentDateTime.getTime() - storedDateTime.getTime();
        expect(difference).to.be.lessThan(1000);

        expect(unfilteredRecords[0].CreatedAt).to.not.equal(null);
        expect(unfilteredRecords[0].LastModifiedAt).to.equal(null);
      });

      it('Modify record: verify last-modified-at is updated', async () => {
        // get current date time
        const currentDateTime = new Date();
        const d1 = new Date();
        d1.setDate(d1.getDate() - 200);

        // sleep for 3 seconds
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // update record
        await request(context.app)
          .patch(`/api/v2/tables/${table.id}/records`)
          .set('xc-auth', context.token)
          .send([
            {
              Id: unfilteredRecords[0].Id,
              DateField: d1.toISOString().slice(0, 10),
            },
          ])
          .expect(200);

        // get updated record
        let updatedRecord = await listRow({
          base,
          table,
          options: { limit: 1 },
        });

        // get stored date time
        const storedDateTime1 = new Date(updatedRecord[0].UpdatedAt);

        // calculate difference between current date time and stored date time
        let difference = storedDateTime1.getTime() - currentDateTime.getTime();
        expect(difference).to.be.greaterThan(1500);
        expect(updatedRecord[0].UpdatedAt).to.not.equal(null);

        // Update again & confirm last modified time is updated
        // sleep for 3 seconds
        await new Promise((resolve) => setTimeout(resolve, 3100));

        // update record
        d1.setDate(d1.getDate() - 100);
        await request(context.app)
          .patch(`/api/v2/tables/${table.id}/records`)
          .set('xc-auth', context.token)
          .send([
            {
              Id: unfilteredRecords[0].Id,
              DateField: d1.toISOString().slice(0, 10),
            },
          ])
          .expect(200);

        // get updated record
        updatedRecord = await listRow({
          base,
          table,
          options: { limit: 1 },
        });

        // get stored date time
        const storedDateTime2 = new Date(updatedRecord[0].UpdatedAt);

        // calculate difference between current date time and stored date time
        difference = storedDateTime2.getTime() - storedDateTime1.getTime();
        expect(difference).to.be.greaterThan(1500);
      });

      it('Modify record: verify that system fields are RO', async () => {
        const d1 = new Date();
        d1.setDate(d1.getDate() - 200);

        // update record
        await request(context.app)
          .patch(`/api/v2/tables/${table.id}/records`)
          .set('xc-auth', context.token)
          .send([
            {
              Id: unfilteredRecords[0].Id,
              CreatedAt: d1.toISOString().slice(0, 10),
              UpdatedAt: d1.toISOString().slice(0, 10),
            },
          ])
          .expect(400);
      });

      it('Add field: verify contents of both fields are same & new field is RO', async () => {
        // add another CreatedTime field
        await createColumn(context, table, {
          title: 'CreatedAt2',
          uidt: UITypes.CreatedTime,
          column_name: 'CreatedAt2',
        });

        // get all columns
        const columns = await getColumnsByAPI(context, base, table);

        // get all records
        const records = await listRow({ base, table });

        // verify contents of both fields are same
        expect(columns.columns[4].title).to.equal('CreatedAt2');
        expect(columns.columns[4].uidt).to.equal(UITypes.CreatedTime);
        expect(columns.columns[4].system).to.equal(false);
        expect(records[0].CreatedAt).to.equal(records[0].CreatedAt2);

        const d1 = new Date();
        d1.setDate(d1.getDate() - 200);

        // update record should fail
        await request(context.app)
          .patch(`/api/v2/tables/${table.id}/records`)
          .set('xc-auth', context.token)
          .send([
            {
              Id: unfilteredRecords[0].Id,
              CreatedAt2: d1.toISOString().slice(0, 10),
            },
          ])
          .expect(400);
      });

      it('Delete & add field: verify contents of both fields are same', async () => {
        // add another CreatedTime field
        await createColumn(context, table, {
          title: 'CreatedAt2',
          uidt: UITypes.CreatedTime,
          column_name: 'CreatedAt2',
        });
        // get all columns
        let columns = await getColumnsByAPI(context, base, table);
        // delete the field
        await deleteColumn(context, { table, column: columns.columns[4] });
        // create column again
        await createColumn(context, table, {
          title: 'CreatedAt2',
          uidt: UITypes.CreatedTime,
          column_name: 'CreatedAt2',
        });
        // get all columns
        columns = await getColumnsByAPI(context, base, table);

        // get all records
        const records = await listRow({ base, table });

        // verify contents of both fields are same
        expect(columns.columns[4].title).to.equal('CreatedAt2');
        expect(columns.columns[4].uidt).to.equal(UITypes.CreatedTime);
        expect(columns.columns[4].system).to.equal(false);
        expect(records[0].CreatedAt).to.equal(records[0].CreatedAt2);
      });
    });
  });
}

export default function () {
  describe('Column types specific behavior', columnTypeSpecificTests);
}
