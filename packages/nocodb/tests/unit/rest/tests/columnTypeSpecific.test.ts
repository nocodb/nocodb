import 'mocha';
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
import { createTable, getColumnsByAPI, getTable } from '../../factory/table';
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

  const defaultTableColumns = [
    {
      title: 'Id',
      uidt: UITypes.ID,
      system: false,
    },
    {
      title: 'DateField',
      uidt: UITypes.Date,
      system: false,
    },
    {
      title: 'CreatedAt',
      uidt: UITypes.CreatedTime,
      system: true,
    },
    {
      title: 'UpdatedAt',
      uidt: UITypes.LastModifiedTime,
      system: true,
    },
    {
      title: 'nc_created_by',
      uidt: UITypes.CreatedBy,
      system: true,
    },
    {
      title: 'nc_updated_by',
      uidt: UITypes.LastModifiedBy,
      system: true,
    },
    {
      title: 'nc_order',
      uidt: UITypes.Order,
      system: true,
    },
  ];

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
      const ctx = {
        workspace_id: sakilaProject.fk_workspace_id,
        base_id: sakilaProject.id,
      };

      // delete referenced value column
      const columnsBeforeReferencedColumnDeleted =
        await customerTable.getColumns(ctx);

      expect(
        columnsBeforeReferencedColumnDeleted.some(
          (col) => col['title'] === qrCodeReferenceColumnTitle,
        ),
      ).to.eq(true);

      const _response = await request(context.app)
        .delete(`/api/v1/db/meta/columns/${qrValueReferenceColumn.id}`)
        .set('xc-auth', context.token)
        .send({});

      const columnsAfterReferencedColumnDeleted =
        await customerTable.getColumns(ctx);
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

  describe('System fields', () => {
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

      const ctx = {
        workspace_id: base.fk_workspace_id,
        base_id: base.id,
      };

      columns = await table.getColumns(ctx);

      const rowAttributes: any = [];
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
        expect(columns.length).to.equal(defaultTableColumns.length);
        for (let i = 0; i < defaultTableColumns.length; i++) {
          expect(columns[i].title).to.equal(defaultTableColumns[i].title);
          expect(columns[i].uidt).to.equal(defaultTableColumns[i].uidt);
          expect(Boolean(columns[i].system)).to.equal(
            defaultTableColumns[i].system,
          );
        }
      });

      it('New table: should not be able to delete system fields', async () => {
        // try to delete system fields
        for (let i = 0; i < defaultTableColumns.length; i++) {
          if (!defaultTableColumns[i].system) return;
          await request(context.app)
            .delete(`/api/v2/meta/columns/${columns[i].id}`)
            .set('xc-auth', context.token)
            .send({})
            .expect(400);

          // try to delete system fields (using v1 api)
          await request(context.app)
            .delete(`/api/v1/db/meta/columns/${columns[i].id}`)
            .set('xc-auth', context.token)
            .send({})
            .expect(400);
        }
      });

      it('New record: verify system fields', async () => {
        // created-at is filled with current dateTime, last-modified-at is null
        // created-by is filled with current user, last-modified-by is null

        const currentDateTime = new Date();
        const storedDateTime = new Date(unfilteredRecords[0].CreatedAt);

        // calculate difference between current date time and stored date time
        const difference = currentDateTime.getTime() - storedDateTime.getTime();
        expect(difference).to.be.lessThan(2000);

        expect(unfilteredRecords[0].CreatedAt).to.not.equal(null);
        expect(unfilteredRecords[0].UpdatedAt).to.equal(null);
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

        // update record with date system fields
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

        // update record with user system fields
        await request(context.app)
          .patch(`/api/v2/tables/${table.id}/records`)
          .set('xc-auth', context.token)
          .send([
            {
              Id: unfilteredRecords[0].Id,
              nc_created_by: 'test@example.com',
              nc_updated_by: 'test@example.com',
            },
          ])
          .expect(400);
      });

      it('Add field: CreatedAt, verify contents of both fields are same & new field is RO', async () => {
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
        expect(columns.columns[defaultTableColumns.length].title).to.equal(
          'CreatedAt2',
        );
        expect(columns.columns[defaultTableColumns.length].uidt).to.equal(
          UITypes.CreatedTime,
        );
        expect(
          Boolean(columns.columns[defaultTableColumns.length].system),
        ).to.equal(false);

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

      it('Add field: CreatedBy, LastModifiedBy verify contents of both fields are proper & new field is RO', async () => {
        // add another CreatedBy field
        await createColumn(context, table, {
          title: 'CreatedBy',
          uidt: UITypes.CreatedBy,
          column_name: 'CreatedBy',
        });

        // add another ModifiedBy field
        await createColumn(context, table, {
          title: 'LastModifiedBy',
          uidt: UITypes.LastModifiedBy,
          column_name: 'LastModifiedBy',
        });

        // get all columns
        const columns = await getColumnsByAPI(context, base, table);

        // get all records
        const records = await listRow({ base, table });

        // verify contents of both fields are same
        expect(columns.columns[defaultTableColumns.length].title).to.equal(
          'CreatedBy',
        );
        expect(columns.columns[defaultTableColumns.length].uidt).to.equal(
          UITypes.CreatedBy,
        );
        expect(
          Boolean(columns.columns[defaultTableColumns.length].system),
        ).to.equal(false);
        expect(records[0].CreatedBy).to.deep.equal({
          id: context.user.id,
          email: context.user.email,
          display_name: context.user.display_name,
          meta: context.user.meta,
        });

        expect(columns.columns[defaultTableColumns.length + 1].title).to.equal(
          'LastModifiedBy',
        );
        expect(columns.columns[defaultTableColumns.length + 1].uidt).to.equal(
          UITypes.LastModifiedBy,
        );
        expect(
          Boolean(columns.columns[defaultTableColumns.length + 1].system),
        ).to.equal(false);
        expect(records[0].LastModifiedBy).to.deep.equal(null);

        // update record should fail
        await request(context.app)
          .patch(`/api/v2/tables/${table.id}/records`)
          .set('xc-auth', context.token)
          .send([
            {
              Id: unfilteredRecords[0].Id,
              CreatedBy: 'user@example.com',
            },
          ])
          .expect(400);

        await request(context.app)
          .patch(`/api/v2/tables/${table.id}/records`)
          .set('xc-auth', context.token)
          .send([
            {
              Id: unfilteredRecords[0].Id,
              LastModifiedBy: 'user@example.com',
            },
          ])
          .expect(400);
      });

      it('Delete & add field: (CreatedAt) verify contents of both fields are same', async () => {
        // add another CreatedTime field
        await createColumn(context, table, {
          title: 'CreatedAt2',
          uidt: UITypes.CreatedTime,
          column_name: 'CreatedAt2',
        });
        // get all columns
        let columns = await getColumnsByAPI(context, base, table);
        // delete the field
        await deleteColumn(context, {
          table,
          column: columns.columns[defaultTableColumns.length],
        });
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
        expect(columns.columns[defaultTableColumns.length].title).to.equal(
          'CreatedAt2',
        );
        expect(columns.columns[defaultTableColumns.length].uidt).to.equal(
          UITypes.CreatedTime,
        );
        expect(
          Boolean(columns.columns[defaultTableColumns.length].system),
        ).to.equal(false);

        expect(records[0].CreatedAt).to.equal(records[0].CreatedAt2);
      });

      it('Delete & add field: (CreatedBy) verify contents of both fields are same', async () => {
        // add another CreatedBy field
        await createColumn(context, table, {
          title: 'CreatedBy',
          uidt: UITypes.CreatedBy,
          column_name: 'CreatedBy',
        });
        // get all columns
        let columns = await getColumnsByAPI(context, base, table);
        // delete the field
        await deleteColumn(context, { table, column: columns.columns[7] });
        // create column again
        await createColumn(context, table, {
          title: 'CreatedBy',
          uidt: UITypes.CreatedBy,
          column_name: 'CreatedBy',
        });
        // get all columns
        columns = await getColumnsByAPI(context, base, table);

        // get all records
        const records = await listRow({ base, table });

        // verify contents of both fields are same
        expect(columns.columns[defaultTableColumns.length].title).to.equal(
          'CreatedBy',
        );
        expect(columns.columns[defaultTableColumns.length].uidt).to.equal(
          UITypes.CreatedBy,
        );
        expect(
          Boolean(columns.columns[defaultTableColumns.length].system),
        ).to.equal(false);
        expect(records[0].CreatedBy).to.deep.equal(records[0].CreatedBy);
      });
    });
  });
}

export default function () {
  describe('Column types specific behavior', columnTypeSpecificTests);
}
