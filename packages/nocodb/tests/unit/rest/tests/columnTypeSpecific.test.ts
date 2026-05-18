import 'mocha';
import request from 'supertest';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import init from '../../init';
import { createProject, createSakilaProject } from '../../factory/base';
import {
  createBarcodeColumn,
  createColumn,
  createLookupColumn,
  createLtarColumn,
  createQrCodeColumn,
  createRollupColumn,
  deleteColumn,
} from '../../factory/column';
import { createTable, getColumnsByAPI, getTable } from '../../factory/table';
import { createBulkRows, listRow, rowMixedValue } from '../../factory/row';
import { META_COL_NAME } from '~/constants';
import type Model from '~/models/Model';
import type Base from '~/models/Base';
import type Column from '~/models/Column';

// Test case list
// 1. Qr Code Column
// a. adding a QR code column which references another column
//   - delivers the same cell values as the referenced column
//   - gets deleted if the referenced column gets deleted

const isEE = process.env.EE === 'true';

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
    {
      title: '__nc_deleted',
      uidt: UITypes.Deleted,
      system: true,
    },
    ...(isEE
      ? [
          {
            title: META_COL_NAME,
            uidt: UITypes.Meta,
            system: true,
          },
        ]
      : []),
    {
      title: 'DateField',
      uidt: UITypes.Date,
      system: false,
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

    it('gets error-marked if the referenced column gets deleted', async () => {
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

      // QR code column should still exist (not cascade-deleted)
      const qrCodeColumn = columnsAfterReferencedColumnDeleted.find(
        (col) => col['title'] === qrCodeReferenceColumnTitle,
      );
      expect(qrCodeColumn).to.not.be.undefined;

      // but should be marked with an error
      const qrCodeColOption = await qrCodeColumn.getColOptions(ctx);
      expect(qrCodeColOption.error).to.be.a('string').and.not.be.empty;
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
          DateField: rowMixedValue(
            columns.find((c) => c.title === 'DateField'),
            i,
          ),
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
        await deleteColumn(context, {
          table,
          column: columns.columns[columns.columns.length - 1],
        });
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

function columnDeleteDependencyTests() {
  let context;
  let base: Base;
  let table1: Model;
  let table2: Model;

  beforeEach(async function () {
    context = await init(true);
    base = await createProject(context);

    table1 = await createTable(context, base, {
      table_name: 'parent',
      title: 'parent',
      columns: [
        { column_name: 'Id', title: 'Id', uidt: UITypes.ID },
        {
          column_name: 'Title',
          title: 'Title',
          uidt: UITypes.SingleLineText,
        },
      ],
    });

    table2 = await createTable(context, base, {
      table_name: 'child',
      title: 'child',
      columns: [
        { column_name: 'Id', title: 'Id', uidt: UITypes.ID },
        {
          column_name: 'Name',
          title: 'Name',
          uidt: UITypes.SingleLineText,
        },
      ],
    });

    await createLtarColumn(context, {
      title: 'Parent Link',
      parentTable: table1,
      childTable: table2,
      type: 'hm',
    });
  });

  const ctx = () => ({
    workspace_id: base.fk_workspace_id,
    base_id: base.id,
  });

  const getColOptions = async (table: Model, colTitle: string) => {
    const columns = await table.getColumns(ctx());
    const col = columns.find((c) => c.title === colTitle);
    expect(col, `Column "${colTitle}" should exist`).to.not.be.undefined;
    return col.getColOptions(ctx());
  };

  const colExists = async (table: Model, colTitle: string) => {
    const columns = await table.getColumns(ctx());
    return columns.find((c) => c.title === colTitle);
  };

  describe('Lookup error-marking', () => {
    it('error-marks lookup when referenced column is deleted', async () => {
      await createLookupColumn(context, {
        base,
        title: 'Child Name Lookup',
        table: table1,
        relatedTableName: table2.table_name,
        relatedTableColumnTitle: 'Name',
      });

      // Delete the "Name" column in the child table
      const childCols = await table2.getColumns(ctx());
      const nameCol = childCols.find((c) => c.title === 'Name');
      await deleteColumn(context, { table: table2, column: nameCol });

      const opts = await getColOptions(table1, 'Child Name Lookup');
      expect(opts.error).to.be.a('string').and.not.be.empty;
    });

    it('error-marks lookup when LTAR relation column is deleted', async () => {
      await createLookupColumn(context, {
        base,
        title: 'Child Name Lookup',
        table: table1,
        relatedTableName: table2.table_name,
        relatedTableColumnTitle: 'Name',
      });

      // Delete the LTAR column
      const parentCols = await table1.getColumns(ctx());
      const ltarCol = parentCols.find((c) => c.title === 'Parent Link');
      await deleteColumn(context, { table: table1, column: ltarCol });

      const opts = await getColOptions(table1, 'Child Name Lookup');
      expect(opts.error).to.be.a('string').and.not.be.empty;
    });
  });

  describe('Rollup error-marking', () => {
    it('error-marks rollup when referenced column is deleted', async () => {
      await createRollupColumn(context, {
        base,
        title: 'Child Name Count',
        table: table1,
        relatedTableName: table2.table_name,
        relatedTableColumnTitle: 'Name',
        rollupFunction: 'count',
      });

      const childCols = await table2.getColumns(ctx());
      const nameCol = childCols.find((c) => c.title === 'Name');
      await deleteColumn(context, { table: table2, column: nameCol });

      const opts = await getColOptions(table1, 'Child Name Count');
      expect(opts.error).to.be.a('string').and.not.be.empty;
    });

    it('error-marks rollup when LTAR relation column is deleted', async () => {
      await createRollupColumn(context, {
        base,
        title: 'Child Name Count',
        table: table1,
        relatedTableName: table2.table_name,
        relatedTableColumnTitle: 'Name',
        rollupFunction: 'count',
      });

      const parentCols = await table1.getColumns(ctx());
      const ltarCol = parentCols.find((c) => c.title === 'Parent Link');
      await deleteColumn(context, { table: table1, column: ltarCol });

      const opts = await getColOptions(table1, 'Child Name Count');
      expect(opts.error).to.be.a('string').and.not.be.empty;
    });
  });

  describe('Barcode error-marking', () => {
    it('error-marks barcode when referenced column is deleted', async () => {
      await createBarcodeColumn(context, {
        title: 'Title Barcode',
        table: table1,
        referencedBarcodeValueTableColumnTitle: 'Title',
      });

      const cols = await table1.getColumns(ctx());
      const titleCol = cols.find((c) => c.title === 'Title');
      await deleteColumn(context, { table: table1, column: titleCol });

      const opts = await getColOptions(table1, 'Title Barcode');
      expect(opts.error).to.be.a('string').and.not.be.empty;
    });
  });

  describe('Transitive dependency error-marking', () => {
    it('error-marks lookup-of-lookup when root column is deleted', async () => {
      // Create Lookup B → child.Name
      await createLookupColumn(context, {
        base,
        title: 'Lookup B',
        table: table1,
        relatedTableName: table2.table_name,
        relatedTableColumnTitle: 'Name',
      });

      // Create a self-referencing LTAR on table1 to use for Lookup C
      await createLtarColumn(context, {
        title: 'Self Link',
        parentTable: table1,
        childTable: table1,
        type: 'hm',
      });

      // Create Lookup C → table1."Lookup B" (via Self Link)
      await createLookupColumn(context, {
        base,
        title: 'Lookup C',
        table: table1,
        relatedTableName: table1.table_name,
        relatedTableColumnTitle: 'Lookup B',
      });

      // Delete the root "Name" column in child table
      const childCols = await table2.getColumns(ctx());
      const nameCol = childCols.find((c) => c.title === 'Name');
      await deleteColumn(context, { table: table2, column: nameCol });

      // Both Lookup B and Lookup C should be error-marked
      const optsB = await getColOptions(table1, 'Lookup B');
      expect(optsB.error).to.be.a('string').and.not.be.empty;

      const optsC = await getColOptions(table1, 'Lookup C');
      expect(optsC.error).to.be.a('string').and.not.be.empty;
    });

    it('error-marks lookup chain across 3 tables (t1→t2→t3)', async () => {
      // t1 HM t2 (already created in beforeEach)
      // t2 HM t3
      const table3 = await createTable(context, base, {
        table_name: 'grandchild',
        title: 'grandchild',
        columns: [
          { column_name: 'Id', title: 'Id', uidt: UITypes.ID },
          {
            column_name: 'TextField',
            title: 'TextField',
            uidt: UITypes.SingleLineText,
          },
        ],
      });

      await createLtarColumn(context, {
        title: 'Child Link',
        parentTable: table2,
        childTable: table3,
        type: 'hm',
      });

      // t2: lookup to t3's TextField
      await createLookupColumn(context, {
        base,
        title: 'T3 Text Lookup',
        table: table2,
        relatedTableName: table3.table_name,
        relatedTableColumnTitle: 'TextField',
      });

      // t1: lookup to t2's lookup (via t1→t2 relation)
      await createLookupColumn(context, {
        base,
        title: 'T2 Lookup of T3',
        table: table1,
        relatedTableName: table2.table_name,
        relatedTableColumnTitle: 'T3 Text Lookup',
      });

      // Delete t3's TextField
      const t3Cols = await table3.getColumns(ctx());
      const textField = t3Cols.find((c) => c.title === 'TextField');
      await deleteColumn(context, { table: table3, column: textField });

      // t2's lookup should be error-marked
      const t2Opts = await getColOptions(table2, 'T3 Text Lookup');
      expect(t2Opts.error).to.be.a('string').and.not.be.empty;

      // t1's lookup (transitive) should also be error-marked
      const t1Opts = await getColOptions(table1, 'T2 Lookup of T3');
      expect(t1Opts.error).to.be.a('string').and.not.be.empty;
    });

    it('error-marks QR code depending on a lookup when root column is deleted', async () => {
      // Create Lookup → child.Name
      await createLookupColumn(context, {
        base,
        title: 'Name Lookup',
        table: table1,
        relatedTableName: table2.table_name,
        relatedTableColumnTitle: 'Name',
      });

      // Create QR Code referencing the Lookup
      await createQrCodeColumn(context, {
        title: 'QR from Lookup',
        table: table1,
        referencedQrValueTableColumnTitle: 'Name Lookup',
      });

      // Delete root "Name" column
      const childCols = await table2.getColumns(ctx());
      const nameCol = childCols.find((c) => c.title === 'Name');
      await deleteColumn(context, { table: table2, column: nameCol });

      // Lookup should be error-marked
      const lookupOpts = await getColOptions(table1, 'Name Lookup');
      expect(lookupOpts.error).to.be.a('string').and.not.be.empty;

      // QR Code should also be error-marked (transitive)
      const qrOpts = await getColOptions(table1, 'QR from Lookup');
      expect(qrOpts.error).to.be.a('string').and.not.be.empty;
    });
  });

  describe('Sort/filter cleanup on error-marked columns', () => {
    it('deletes sorts referencing error-marked columns', async () => {
      await createLookupColumn(context, {
        base,
        title: 'Name Lookup',
        table: table1,
        relatedTableName: table2.table_name,
        relatedTableColumnTitle: 'Name',
      });

      const parentCols = await table1.getColumns(ctx());
      const lookupCol = parentCols.find((c) => c.title === 'Name Lookup');

      // Add a sort on the lookup column via API
      const views = await request(context.app)
        .get(`/api/v1/db/meta/tables/${table1.id}`)
        .set('xc-auth', context.token)
        .expect(200);
      const defaultViewId = views.body.views[0].id;

      await request(context.app)
        .post(`/api/v1/db/meta/views/${defaultViewId}/sorts`)
        .set('xc-auth', context.token)
        .send({ fk_column_id: lookupCol.id, direction: 'asc' })
        .expect(200);

      // Verify sort exists
      let sortsRes = await request(context.app)
        .get(`/api/v1/db/meta/views/${defaultViewId}/sorts`)
        .set('xc-auth', context.token)
        .expect(200);
      expect(sortsRes.body.list.length).to.be.greaterThan(0);

      // Delete the "Name" column to trigger error-marking
      const childCols = await table2.getColumns(ctx());
      const nameCol = childCols.find((c) => c.title === 'Name');
      await deleteColumn(context, { table: table2, column: nameCol });

      // Sort on the error-marked lookup should be cleaned up
      sortsRes = await request(context.app)
        .get(`/api/v1/db/meta/views/${defaultViewId}/sorts`)
        .set('xc-auth', context.token)
        .expect(200);

      const lookupSorts = (sortsRes.body.list || []).filter(
        (s) => s.fk_column_id === lookupCol.id,
      );
      expect(lookupSorts.length).to.equal(0);
    });
  });

  describe('Error-marked columns are preserved (not deleted)', () => {
    it('lookup column still exists after source column deleted', async () => {
      await createLookupColumn(context, {
        base,
        title: 'Preserved Lookup',
        table: table1,
        relatedTableName: table2.table_name,
        relatedTableColumnTitle: 'Name',
      });

      const childCols = await table2.getColumns(ctx());
      const nameCol = childCols.find((c) => c.title === 'Name');
      await deleteColumn(context, { table: table2, column: nameCol });

      // Column should still exist
      const col = await colExists(table1, 'Preserved Lookup');
      expect(col).to.not.be.undefined;
      expect(col.uidt).to.equal(UITypes.Lookup);
    });
  });
}

export default function () {
  describe('Column types specific behavior', columnTypeSpecificTests);
  describe('Column delete dependency handler', columnDeleteDependencyTests);
}
