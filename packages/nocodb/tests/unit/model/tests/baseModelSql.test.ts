import 'mocha';
import { expect } from 'chai';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import { createRow, generateDefaultRowAttributes } from '../../factory/row';
import { createLtarColumn } from '../../factory/column';
import { isPg, isSqlite } from '../../init/db';
import type View from '~/models/View';
import type Base from '~/models/Base';
import type Model from '~/models/Model';
import type LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import Filter from '~/models/Filter';
import Audit from '~/models/Audit';
import Source from '~/models/Source';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

function baseModelSqlTests() {
  let context;
  let base: Base;
  let table: Model;
  let view: View;
  let baseModelSql: BaseModelSqlv2;

  beforeEach(async function () {
    console.time('#### baseModelSqlTests');
    context = await init();
    base = await createProject(context);
    table = await createTable(context, base);
    view = await table.getViews()[0];

    const source = await Source.get(table.source_id);
    baseModelSql = new BaseModelSqlv2({
      dbDriver: await NcConnectionMgrv2.get(source),
      model: table,
      view,
    });
    console.timeEnd('#### baseModelSqlTests');
  });

  it('Insert record', async () => {
    const request = {
      clientIp: '::ffff:192.0.0.1',
      user: { email: 'test@example.com' },
    };
    const columns = await table.getColumns();

    const inputData: any = generateDefaultRowAttributes({ columns });
    const response = await baseModelSql.insert(
      generateDefaultRowAttributes({ columns }),
      undefined,
      request,
    );
    const insertedRow = (await baseModelSql.list())[0];

    if (isPg(context)) {
      inputData.CreatedAt = new Date(inputData.CreatedAt).toISOString();
      inputData.UpdatedAt = new Date(inputData.UpdatedAt).toISOString();

      insertedRow.CreatedAt = new Date(insertedRow.CreatedAt).toISOString();
      insertedRow.UpdatedAt = new Date(insertedRow.UpdatedAt).toISOString();

      response.CreatedAt = new Date(response.CreatedAt).toISOString();
      response.UpdatedAt = new Date(response.UpdatedAt).toISOString();
    } else if (isSqlite(context)) {
      // append +00:00 to the date string
      inputData.CreatedAt = `${inputData.CreatedAt}+00:00`;
      inputData.UpdatedAt = `${inputData.UpdatedAt}+00:00`;
    }

    expect(insertedRow).to.include(inputData);
    expect(insertedRow).to.include(response);

    const rowInsertedAudit = (
      await Audit.baseAuditList(base.id, {})
    ).find((audit) => audit.op_sub_type === 'INSERT');
    expect(rowInsertedAudit).to.include({
      user: 'test@example.com',
      ip: '::ffff:192.0.0.1',
      source_id: table.source_id,
      base_id: base.id,
      fk_model_id: table.id,
      row_id: '1',
      op_type: 'DATA',
      op_sub_type: 'INSERT',
      description: 'Record with ID 1 has been inserted into Table Table1_Title',
    });
  });

  it('Bulk insert record', async () => {
    const columns = await table.getColumns();
    const request = {
      clientIp: '::ffff:192.0.0.1',
      user: { email: 'test@example.com' },
    };
    const bulkData = Array(10)
      .fill(0)
      .map((_, index) => generateDefaultRowAttributes({ columns, index }));
    await baseModelSql.bulkInsert(bulkData, { cookie: request });

    const insertedRows = await baseModelSql.list();

    if (isPg(context)) {
      insertedRows.forEach((row) => {
        row.CreatedAt = new Date(row.CreatedAt).toISOString();
        row.UpdatedAt = new Date(row.UpdatedAt).toISOString();
      });
    }

    bulkData.forEach((inputData: any, index) => {
      if (isPg(context)) {
        inputData.CreatedAt = new Date(inputData.CreatedAt).toISOString();
        inputData.UpdatedAt = new Date(inputData.UpdatedAt).toISOString();
      } else if (isSqlite(context)) {
        // append +00:00 to the date string
        inputData.CreatedAt = `${inputData.CreatedAt}+00:00`;
        inputData.UpdatedAt = `${inputData.UpdatedAt}+00:00`;
      }
      expect(insertedRows[index]).to.include(inputData);
    });

    const rowBulkInsertedAudit = (
      await Audit.baseAuditList(base.id, {})
    ).find((audit) => audit.op_sub_type === 'BULK_INSERT');
    expect(rowBulkInsertedAudit).to.include({
      user: 'test@example.com',
      ip: '::ffff:192.0.0.1',
      source_id: table.source_id,
      base_id: base.id,
      fk_model_id: table.id,
      row_id: null,
      op_type: 'DATA',
      op_sub_type: 'BULK_INSERT',
      status: null,
      description: '10 records have been bulk inserted in Table1_Title',
      details: null,
    });
  });

  it('Update record', async () => {
    const request = {
      clientIp: '::ffff:192.0.0.1',
      user: { email: 'test@example.com' },
    };

    const columns = await table.getColumns();

    await baseModelSql.insert(generateDefaultRowAttributes({ columns }));
    const rowId = 1;
    await baseModelSql.updateByPk(rowId, { Title: 'test' }, undefined, request);

    const updatedRow = await baseModelSql.readByPk(1);

    expect(updatedRow).to.include({ Id: rowId, Title: 'test' });

    const rowUpdatedAudit = (await Audit.baseAuditList(base.id, {})).find(
      (audit) => audit.op_sub_type === 'UPDATE',
    );
    expect(rowUpdatedAudit).to.include({
      user: 'test@example.com',
      ip: '::ffff:192.0.0.1',
      source_id: table.source_id,
      base_id: base.id,
      fk_model_id: table.id,
      row_id: '1',
      op_type: 'DATA',
      op_sub_type: 'UPDATE',
      description:
        'Record with ID 1 has been updated in Table Table1_Title.\nColumn "Title" got changed from "test-0" to "test"',
    });
  });

  it('Bulk update record', async () => {
    // Since sqlite doesn't support multiple sql connections, we can't test bulk update in sqlite
    if (isSqlite(context)) return;

    const columns = await table.getColumns();
    const request = {
      clientIp: '::ffff:192.0.0.1',
      user: { email: 'test@example.com' },
    };
    const bulkData = Array(10)
      .fill(0)
      .map((_, index) => generateDefaultRowAttributes({ columns, index }));
    await baseModelSql.bulkInsert(bulkData, { cookie: request });

    const insertedRows: any[] = await baseModelSql.list();

    await baseModelSql.bulkUpdate(
      insertedRows.map((row) => ({ ...row, Title: `new-${row['Title']}` })),
      { cookie: request },
    );

    const updatedRows = await baseModelSql.list();

    updatedRows.forEach((row, index) => {
      expect(row['Title']).to.equal(`new-test-${index}`);
    });
    const rowBulkUpdateAudit = (
      await Audit.baseAuditList(base.id, {})
    ).find((audit) => audit.op_sub_type === 'BULK_UPDATE');
    expect(rowBulkUpdateAudit).to.include({
      user: 'test@example.com',
      ip: '::ffff:192.0.0.1',
      source_id: table.source_id,
      fk_model_id: table.id,
      base_id: base.id,
      row_id: null,
      op_type: 'DATA',
      op_sub_type: 'BULK_UPDATE',
      status: null,
      description: '10 records have been bulk updated in Table1_Title',
      details: null,
    });
  });

  it('Bulk update all record', async () => {
    const columns = await table.getColumns();
    const request = {
      clientIp: '::ffff:192.0.0.1',
      user: { email: 'test@example.com' },
    };
    const bulkData = Array(10)
      .fill(0)
      .map((_, index) => generateDefaultRowAttributes({ columns, index }));
    await baseModelSql.bulkInsert(bulkData, { cookie: request });

    const idColumn = columns.find((column) => column.title === 'Id')!;

    await baseModelSql.bulkUpdateAll(
      {
        filterArr: [
          new Filter({
            logical_op: 'and',
            fk_column_id: idColumn.id,
            comparison_op: 'lt',
            value: 5,
          }),
        ],
      },
      { Title: 'new-1' },
      { cookie: request },
    );

    const updatedRows = await baseModelSql.list();

    updatedRows.forEach((row) => {
      if (row.id < 5) expect(row['Title']).to.equal('new-1');
    });
    const rowBulkUpdateAudit = (
      await Audit.baseAuditList(base.id, {})
    ).find((audit) => audit.op_sub_type === 'BULK_UPDATE');
    expect(rowBulkUpdateAudit).to.include({
      user: 'test@example.com',
      ip: '::ffff:192.0.0.1',
      source_id: table.source_id,
      fk_model_id: table.id,
      base_id: base.id,
      row_id: null,
      op_type: 'DATA',
      op_sub_type: 'BULK_UPDATE',
      status: null,
      description: '4 records have been bulk updated in Table1_Title',
      details: null,
    });
  });

  it('Delete record', async () => {
    const request = {
      clientIp: '::ffff:192.0.0.1',
      user: { email: 'test@example.com' },
      params: { id: 1 },
    };

    const columns = await table.getColumns();
    const bulkData = Array(10)
      .fill(0)
      .map((_, index) => generateDefaultRowAttributes({ columns, index }));
    await baseModelSql.bulkInsert(bulkData, { cookie: request });

    const rowIdToDeleted = 1;
    await baseModelSql.delByPk(rowIdToDeleted, undefined, request);

    const deletedRow = await baseModelSql.readByPk(rowIdToDeleted);

    expect(deletedRow).to.be.null;

    console.log('Delete record', await Audit.baseAuditList(base.id, {}));
    const rowDeletedAudit = (await Audit.baseAuditList(base.id, {})).find(
      (audit) => audit.op_sub_type === 'DELETE',
    );
    expect(rowDeletedAudit).to.include({
      user: 'test@example.com',
      ip: '::ffff:192.0.0.1',
      source_id: table.source_id,
      base_id: base.id,
      fk_model_id: table.id,
      row_id: '1',
      op_type: 'DATA',
      op_sub_type: 'DELETE',
      description: 'Record with ID 1 has been deleted in Table Table1_Title',
    });
  });

  it('Bulk delete records', async () => {
    const columns = await table.getColumns();
    const request = {
      clientIp: '::ffff:192.0.0.1',
      user: { email: 'test@example.com' },
    };
    const bulkData = Array(10)
      .fill(0)
      .map((_, index) => generateDefaultRowAttributes({ columns, index }));
    await baseModelSql.bulkInsert(bulkData, { cookie: request });

    const insertedRows: any[] = await baseModelSql.list();

    await baseModelSql.bulkDelete(
      insertedRows
        .filter((row) => row['Id'] < 5)
        .map((row) => ({ id: row['Id'] })),
      { cookie: request },
    );

    const remainingRows = await baseModelSql.list();

    expect(remainingRows).to.length(6);

    const rowBulkDeleteAudit = (
      await Audit.baseAuditList(base.id, {})
    ).find((audit) => audit.op_sub_type === 'BULK_DELETE');

    expect(rowBulkDeleteAudit).to.include({
      user: 'test@example.com',
      ip: '::ffff:192.0.0.1',
      source_id: table.source_id,
      fk_model_id: table.id,
      base_id: base.id,
      row_id: null,
      op_type: 'DATA',
      op_sub_type: 'BULK_DELETE',
      status: null,
      description: '4 records have been bulk deleted in Table1_Title',
      details: null,
    });
  });

  it('Bulk delete all record', async () => {
    const columns = await table.getColumns();
    const request = {
      clientIp: '::ffff:192.0.0.1',
      user: { email: 'test@example.com' },
    };
    const bulkData = Array(10)
      .fill(0)
      .map((_, index) => generateDefaultRowAttributes({ columns, index }));
    await baseModelSql.bulkInsert(bulkData, { cookie: request });

    const idColumn = columns.find((column) => column.title === 'Id')!;

    await baseModelSql.bulkDeleteAll(
      {
        filterArr: [
          new Filter({
            logical_op: 'and',
            fk_column_id: idColumn.id,
            comparison_op: 'lt',
            value: 5,
          }),
        ],
      },
      { cookie: request },
    );

    const remainingRows = await baseModelSql.list();

    expect(remainingRows).to.length(6);
    const rowBulkDeleteAudit = (
      await Audit.baseAuditList(base.id, {})
    ).find((audit) => audit.op_sub_type === 'BULK_DELETE');
    expect(rowBulkDeleteAudit).to.include({
      user: 'test@example.com',
      ip: '::ffff:192.0.0.1',
      source_id: table.source_id,
      fk_model_id: table.id,
      base_id: base.id,
      row_id: null,
      op_type: 'DATA',
      op_sub_type: 'BULK_DELETE',
      status: null,
      description: '4 records have been bulk deleted in Table1_Title',
      details: null,
    });
  });

  it('Nested insert', async () => {
    const childTable = await createTable(context, base, {
      title: 'Child Table',
      table_name: 'child_table',
    });
    const ltarColumn = await createLtarColumn(context, {
      title: 'Ltar Column',
      parentTable: table,
      childTable,
      type: 'hm',
    });
    const childRow = await createRow(context, {
      base,
      table: childTable,
    });
    const ltarColOptions =
      await ltarColumn.getColOptions<LinkToAnotherRecordColumn>();
    const childCol = await ltarColOptions.getChildColumn();

    const columns = await table.getColumns();
    const request = {
      clientIp: '::ffff:192.0.0.1',
      user: { email: 'test@example.com' },
    };

    await baseModelSql.nestedInsert(
      {
        ...generateDefaultRowAttributes({ columns }),
        [ltarColumn.title]: [{ Id: childRow['Id'] }],
      },
      undefined,
      request,
    );

    const childBaseModel = new BaseModelSqlv2({
      dbDriver: await NcConnectionMgrv2.get(await Source.get(table.source_id)),
      model: childTable,
      view,
    });
    const insertedChildRow = await childBaseModel.readByPk(childRow['Id']);
    expect(insertedChildRow[childCol.column_name]).to.equal(childRow['Id']);

    const rowInsertedAudit = (await Audit.baseAuditList(base.id, {}))
      .filter((audit) => audit.fk_model_id === table.id)
      .find((audit) => audit.op_sub_type === 'INSERT');

    expect(rowInsertedAudit).to.include({
      user: 'test@example.com',
      ip: '::ffff:192.0.0.1',
      source_id: table.source_id,
      base_id: base.id,
      fk_model_id: table.id,
      row_id: '1',
      op_type: 'DATA',
      op_sub_type: 'INSERT',
      description: 'Record with ID 1 has been inserted into Table Table1_Title',
    });
  });

  it('Link child', async () => {
    const childTable = await createTable(context, base, {
      title: 'Child Table',
      table_name: 'child_table',
    });
    const ltarColumn = await createLtarColumn(context, {
      title: 'Ltar Column',
      parentTable: table,
      childTable,
      type: 'hm',
    });
    const insertedChildRow = await createRow(context, {
      base,
      table: childTable,
    });
    const ltarColOptions =
      await ltarColumn.getColOptions<LinkToAnotherRecordColumn>();
    const childCol = await ltarColOptions.getChildColumn();

    const columns = await table.getColumns();
    const request = {
      clientIp: '::ffff:192.0.0.1',
      user: { email: 'test@example.com' },
    };

    await baseModelSql.insert(
      generateDefaultRowAttributes({ columns }),
      undefined,
      request,
    );
    const insertedRow = await baseModelSql.readByPk(1);

    await baseModelSql.addChild({
      colId: ltarColumn.id,
      rowId: insertedRow['Id'],
      childId: insertedChildRow['Id'],
      cookie: request,
    });

    const childBaseModel = new BaseModelSqlv2({
      dbDriver: await NcConnectionMgrv2.get(await Source.get(table.source_id)),
      model: childTable,
      view,
    });
    const updatedChildRow = await childBaseModel.readByPk(
      insertedChildRow['Id'],
    );

    expect(updatedChildRow[childCol.column_name]).to.equal(insertedRow['Id']);

    const rowInsertedAudit = (await Audit.baseAuditList(base.id, {}))
      .filter((audit) => audit.fk_model_id === table.id)
      .find((audit) => audit.op_sub_type === 'LINK_RECORD');

    expect(rowInsertedAudit).to.include({
      user: 'test@example.com',
      ip: '::ffff:192.0.0.1',
      source_id: table.source_id,
      base_id: base.id,
      fk_model_id: table.id,
      row_id: '1',
      op_type: 'DATA',
      op_sub_type: 'LINK_RECORD',
      description:
        'Record [id:1] has been linked with record [id:1] in Table1_Title',
    });
  });

  it('Unlink child', async () => {
    const childTable = await createTable(context, base, {
      title: 'Child Table',
      table_name: 'child_table',
    });
    const ltarColumn = await createLtarColumn(context, {
      title: 'Ltar Column',
      parentTable: table,
      childTable,
      type: 'hm',
    });
    const insertedChildRow = await createRow(context, {
      base,
      table: childTable,
    });
    const ltarColOptions =
      await ltarColumn.getColOptions<LinkToAnotherRecordColumn>();
    const childCol = await ltarColOptions.getChildColumn();

    const columns = await table.getColumns();
    const request = {
      clientIp: '::ffff:192.0.0.1',
      user: { email: 'test@example.com' },
    };

    await baseModelSql.insert(
      generateDefaultRowAttributes({ columns }),
      undefined,
      request,
    );
    const insertedRow = await baseModelSql.readByPk(1);

    await baseModelSql.addChild({
      colId: ltarColumn.id,
      rowId: insertedRow['Id'],
      childId: insertedChildRow['Id'],
      cookie: request,
    });

    await baseModelSql.removeChild({
      colId: ltarColumn.id,
      rowId: insertedRow['Id'],
      childId: insertedChildRow['Id'],
      cookie: request,
    });

    const childBaseModel = new BaseModelSqlv2({
      dbDriver: await NcConnectionMgrv2.get(await Source.get(table.source_id)),
      model: childTable,
      view,
    });
    const updatedChildRow = await childBaseModel.readByPk(
      insertedChildRow['Id'],
    );

    expect(updatedChildRow[childCol.column_name]).to.be.null;

    const rowInsertedAudit = (await Audit.baseAuditList(base.id, {}))
      .filter((audit) => audit.fk_model_id === table.id)
      .find((audit) => audit.op_sub_type === 'UNLINK_RECORD');

    expect(rowInsertedAudit).to.include({
      user: 'test@example.com',
      ip: '::ffff:192.0.0.1',
      source_id: table.source_id,
      base_id: base.id,
      fk_model_id: table.id,
      row_id: '1',
      op_type: 'DATA',
      op_sub_type: 'UNLINK_RECORD',
      description:
        'Record [id:1] has been unlinked with record [id:1] in Table1_Title',
    });
  });
}

export default function () {
  describe('BaseModelSql', baseModelSqlTests);
}
