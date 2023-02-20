import { UITypes } from 'nocodb-sdk';
import request from 'supertest';
import Column from '../../../src/lib/models/Column';
import FormViewColumn from '../../../src/lib/models/FormViewColumn';
import GalleryViewColumn from '../../../src/lib/models/GalleryViewColumn';
import GridViewColumn from '../../../src/lib/models/GridViewColumn';
import Model from '../../../src/lib/models/Model';
import Project from '../../../src/lib/models/Project';
import View from '../../../src/lib/models/View';
import { isSqlite } from '../init/db';

const defaultColumns = function (context) {
  return [
    {
      column_name: 'id',
      title: 'Id',
      uidt: 'ID',
    },
    {
      column_name: 'title',
      title: 'Title',
      uidt: 'SingleLineText',
    },
    {
      cdf: 'CURRENT_TIMESTAMP',
      column_name: 'created_at',
      title: 'CreatedAt',
      dtxp: '',
      dtxs: '',
      uidt: 'DateTime',
    },
    {
      cdf: isSqlite(context)
        ? 'CURRENT_TIMESTAMP'
        : 'CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP',
      column_name: 'updated_at',
      title: 'UpdatedAt',
      dtxp: '',
      dtxs: '',
      uidt: 'DateTime',
    },
  ];
};

const createColumn = async (context, table, columnAttr) => {
  await request(context.app)
    .post(`/api/v1/db/meta/tables/${table.id}/columns`)
    .set('xc-auth', context.token)
    .send({
      ...columnAttr,
    });

  const column: Column = (await table.getColumns()).find(
    (column) => column.title === columnAttr.title
  );
  return column;
};

const createRollupColumn = async (
  context,
  {
    project,
    title,
    rollupFunction,
    table,
    relatedTableName,
    relatedTableColumnTitle,
  }: {
    project: Project;
    title: string;
    rollupFunction: string;
    table: Model;
    relatedTableName: string;
    relatedTableColumnTitle: string;
  }
) => {
  const childBases = await project.getBases();
  const childTable = await Model.getByIdOrName({
    project_id: project.id,
    base_id: childBases[0].id!,
    table_name: relatedTableName,
  });
  const childTableColumns = await childTable.getColumns();
  const childTableColumn = await childTableColumns.find(
    (column) => column.title === relatedTableColumnTitle
  );

  const ltarColumn = (await table.getColumns()).find(
    (column) =>
      column.uidt === UITypes.LinkToAnotherRecord &&
      column.colOptions?.fk_related_model_id === childTable.id
  );

  const rollupColumn = await createColumn(context, table, {
    title: title,
    uidt: UITypes.Rollup,
    fk_relation_column_id: ltarColumn?.id,
    fk_rollup_column_id: childTableColumn?.id,
    rollup_function: rollupFunction,
    table_name: table.table_name,
    column_name: title,
  });

  return rollupColumn;
};

const createLookupColumn = async (
  context,
  {
    project,
    title,
    table,
    relatedTableName,
    relatedTableColumnTitle,
  }: {
    project: Project;
    title: string;
    table: Model;
    relatedTableName: string;
    relatedTableColumnTitle: string;
  }
) => {
  const childBases = await project.getBases();
  const childTable = await Model.getByIdOrName({
    project_id: project.id,
    base_id: childBases[0].id!,
    table_name: relatedTableName,
  });
  const childTableColumns = await childTable.getColumns();
  const childTableColumn = await childTableColumns.find(
    (column) => column.title === relatedTableColumnTitle
  );

  if (!childTableColumn) {
    throw new Error(
      `Could not find column ${relatedTableColumnTitle} in ${relatedTableName}`
    );
  }

  const ltarColumn = (await table.getColumns()).find(
    (column) =>
      column.uidt === UITypes.LinkToAnotherRecord &&
      column.colOptions?.fk_related_model_id === childTable.id
  );
  const lookupColumn = await createColumn(context, table, {
    title: title,
    uidt: UITypes.Lookup,
    fk_relation_column_id: ltarColumn?.id,
    fk_lookup_column_id: childTableColumn?.id,
    table_name: table.table_name,
    column_name: title,
  });

  return lookupColumn;
};

const createQrCodeColumn = async (
  context,
  {
    title,
    table,
    referencedQrValueTableColumnTitle,
  }: {
    title: string;
    table: Model;
    referencedQrValueTableColumnTitle: string;
  }
) => {
  const referencedQrValueTableColumnId = await table
    .getColumns()
    .then(
      (cols) =>
        cols.find(
          (column) => column.title == referencedQrValueTableColumnTitle
        )['id']
    );

  const qrCodeColumn = await createColumn(context, table, {
    title: title,
    uidt: UITypes.QrCode,
    column_name: title,
    fk_qr_value_column_id: referencedQrValueTableColumnId,
  });
  return qrCodeColumn;
};

const createBarcodeColumn = async (
  context,
  {
    title,
    table,
    referencedBarcodeValueTableColumnTitle,
  }: {
    title: string;
    table: Model;
    referencedBarcodeValueTableColumnTitle: string;
  }
) => {
  const referencedBarcodeValueTableColumnId = await table
    .getColumns()
    .then(
      (cols) =>
        cols.find(
          (column) => column.title == referencedBarcodeValueTableColumnTitle
        )['id']
    );

  const barcodeColumn = await createColumn(context, table, {
    title: title,
    uidt: UITypes.Barcode,
    column_name: title,
    fk_barcode_value_column_id: referencedBarcodeValueTableColumnId,
  });
  return barcodeColumn;
};

const createLtarColumn = async (
  context,
  {
    title,
    parentTable,
    childTable,
    type,
  }: {
    title: string;
    parentTable: Model;
    childTable: Model;
    type: string;
  }
) => {
  const ltarColumn = await createColumn(context, parentTable, {
    title: title,
    column_name: title,
    uidt: UITypes.LinkToAnotherRecord,
    parentId: parentTable.id,
    childId: childTable.id,
    type: type,
  });

  return ltarColumn;
};

const updateViewColumn = async (
  context,
  { view, column, attr }: { column: Column; view: View; attr: any }
) => {
  const res = await request(context.app)
    .patch(`/api/v1/db/meta/views/${view.id}/columns/${column.id}`)
    .set('xc-auth', context.token)
    .send({
      ...attr,
    });

  const updatedColumn: FormViewColumn | GridViewColumn | GalleryViewColumn = (
    await view.getColumns()
  ).find((column) => column.id === column.id)!;

  return updatedColumn;
};

export {
  defaultColumns,
  createColumn,
  createQrCodeColumn,
  createBarcodeColumn,
  createRollupColumn,
  createLookupColumn,
  createLtarColumn,
  updateViewColumn,
};
