import { UITypes } from 'nocodb-sdk';
import request from 'supertest';

import { isPg, isSqlite } from '../init/db';
import {
  Base,
  FormViewColumn,
  GridViewColumn,
  GalleryViewColumn,
  Column,
  View,
  Model,
} from '../../../src/models';
import init from '../init';

type Context = Awaited<ReturnType<typeof init>>;

const defaultColumns = function (
  context: Context,
  isV3: boolean = false,
  optionsOverride: Record<string, any> = {},
) {
  return [
    isV3
      ? {
          name: 'Id',
          type: 'ID',
          description: 'Test Id',
          options: {
            ...optionsOverride['Id'],
          },
        }
      : {
          column_name: 'id',
          title: 'Id',
          uidt: 'ID',
          description: 'Test Id',
          ...optionsOverride['Id'],
        },
    isV3
      ? {
          name: 'Title',
          type: 'SingleLineText',
          description: 'Title SingleLineText',
          options: {
            ...optionsOverride['Title'],
          },
        }
      : {
          column_name: 'title',
          title: 'Title',
          uidt: 'SingleLineText',
          description: 'Title SingleLineText',
          ...optionsOverride['Title'],
        },
    isV3
      ? {
          name: 'CreatedAt',
          type: 'CreatedTime',
          description: 'CreatedAt CreatedTime',
          options: {
            ...optionsOverride['CreatedAt'],
          },
        }
      : {
          column_name: 'created_at',
          title: 'CreatedAt',
          uidt: 'CreatedTime',
          description: 'CreatedAt CreatedTime',
          ...optionsOverride['CreatedAt'],
        },
    isV3
      ? {
          name: 'UpdatedAt',
          type: 'LastModifiedTime',
          description: 'UpdatedAt LastModifiedTime',
          options: {
            ...optionsOverride['UpdateAt'],
          },
        }
      : {
          column_name: 'updated_at',
          title: 'UpdatedAt',
          uidt: 'LastModifiedTime',
          description: 'UpdatedAt LastModifiedTime',
          ...optionsOverride['UpdateAt'],
        },
    isV3
      ? {
          name: 'CreatedBy',
          type: 'CreatedBy',
          description: 'CreatedBy CreatedBy',
          options: {
            ...optionsOverride['CreatedBy'],
          },
        }
      : {
          column_name: 'created_by',
          title: 'CreatedBy',
          uidt: 'CreatedBy',
          description: 'CreatedBy CreatedBy',
          ...optionsOverride['CreatedBy'],
        },
    isV3
      ? {
          name: 'UpdatedBy',
          type: 'LastModifiedBy',
          description: 'UpdatedBy LastModifiedBy',
          options: {
            ...optionsOverride['UpdatedBy'],
          },
        }
      : {
          column_name: 'updated_by',
          title: 'UpdatedBy',
          uidt: 'LastModifiedBy',
          description: 'UpdatedBy LastModifiedBy',
          ...optionsOverride['UpdatedBy'],
        },
    isV3 ? {
      name: 'NcOrder',
      type: 'Number',
      description: 'NcOrder Number',
      options: {
        ...optionsOverride['NcOrder'],
      }
    } : {
      column_name: 'nc_order',
      title: 'NcOrder',
      uidt: 'Number',
      description: 'NcOrder Number',
      ...optionsOverride['NcOrder']
    }
  ];
};

const customColumns = function (type: string, options: any = {}) {
  switch (type) {
    case 'textBased':
      return [
        {
          column_name: 'id',
          title: 'Id',
          uidt: UITypes.ID,
        },
        {
          column_name: 'SingleLineText',
          title: 'SingleLineText',
          uidt: UITypes.SingleLineText,
        },
        {
          column_name: 'MultiLineText',
          title: 'MultiLineText',
          uidt: UITypes.LongText,
        },
        {
          column_name: 'Email',
          title: 'Email',
          uidt: UITypes.Email,
        },
        {
          column_name: 'Phone',
          title: 'Phone',
          uidt: UITypes.PhoneNumber,
        },
        {
          column_name: 'Url',
          title: 'Url',
          uidt: UITypes.URL,
        },
      ];
    case 'numberBased':
      return [
        {
          column_name: 'id',
          title: 'Id',
          uidt: UITypes.ID,
        },
        {
          column_name: 'Number',
          title: 'Number',
          uidt: UITypes.Number,
        },
        {
          column_name: 'Decimal',
          title: 'Decimal',
          uidt: UITypes.Decimal,
        },
        {
          column_name: 'Currency',
          title: 'Currency',
          uidt: UITypes.Currency,
        },
        {
          column_name: 'Percent',
          title: 'Percent',
          uidt: UITypes.Percent,
        },
        {
          column_name: 'Duration',
          title: 'Duration',
          uidt: UITypes.Duration,
        },
        {
          column_name: 'Rating',
          title: 'Rating',
          uidt: UITypes.Rating,
        },
      ];
    case 'dateBased':
      return [
        {
          column_name: 'id',
          title: 'Id',
          uidt: UITypes.ID,
        },
        {
          column_name: 'Date',
          title: 'Date',
          uidt: UITypes.Date,
        },
        {
          column_name: 'DateTime',
          title: 'DateTime',
          uidt: UITypes.DateTime,
        },
      ];
    case 'selectBased':
      return [
        {
          column_name: 'id',
          title: 'Id',
          uidt: UITypes.ID,
        },
        {
          column_name: 'SingleSelect',
          title: 'SingleSelect',
          uidt: UITypes.SingleSelect,
          dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
        },
        {
          column_name: 'MultiSelect',
          title: 'MultiSelect',
          uidt: UITypes.MultiSelect,
          dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
        },
      ];
    case 'userBased':
      return [
        {
          column_name: 'id',
          title: 'Id',
          uidt: UITypes.ID,
        },
        {
          column_name: 'userFieldSingle',
          title: 'userFieldSingle',
          uidt: UITypes.User,
        },
        {
          column_name: 'userFieldMulti',
          title: 'userFieldMulti',
          uidt: UITypes.User,
          meta: { is_multi: true },
        },
      ];
    case 'aggregationBased':
      return [
        {
          column_name: 'Id',
          title: 'Id',
          uidt: UITypes.ID,
          ai: 1,
          pk: 1,
        },
        {
          column_name: 'SingleLineText',
          title: 'Title',
          uidt: UITypes.SingleLineText,
        },
        {
          column_name: 'Attachment',
          title: 'Attachment',
          uidt: UITypes.Attachment,
        },
        {
          column_name: 'User',
          title: 'User',
          uidt: UITypes.User,
        },
        {
          column_name: 'LongText',
          title: 'LongText',
          uidt: UITypes.LongText,
        },
        {
          column_name: 'Number',
          title: 'Number',
          uidt: UITypes.Number,
        },
        {
          column_name: 'Decimal',
          title: 'Decimal',
          uidt: UITypes.Decimal,
        },
        {
          column_name: 'Checkbox',
          title: 'Checkbox',
          uidt: UITypes.Checkbox,
        },
        {
          column_name: 'MultiSelect',
          title: 'MultiSelect',
          uidt: UITypes.MultiSelect,
          dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
        },
        {
          column_name: 'SingleSelect',
          title: 'SingleSelect',
          uidt: UITypes.SingleSelect,
          dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
        },
        {
          column_name: 'Date',
          title: 'Date',
          uidt: UITypes.Date,
        },
        {
          column_name: 'DateTime',
          title: 'DateTime',
          uidt: UITypes.DateTime,
        },
        {
          column_name: 'Year',
          title: 'Year',
          uidt: UITypes.Year,
        },
        {
          column_name: 'Time',
          title: 'Time',
          uidt: UITypes.Time,
        },
        {
          column_name: 'PhoneNumber',
          title: 'PhoneNumber',
          uidt: UITypes.PhoneNumber,
        },
        {
          column_name: 'Email',
          title: 'Email',
          uidt: UITypes.Email,
        },
        {
          column_name: 'Url',
          title: 'Url',
          uidt: UITypes.URL,
        },
        {
          column_name: 'Currency',
          title: 'Currency',
          uidt: UITypes.Currency,
        },
        {
          column_name: 'Percent',
          title: 'Percent',
          uidt: UITypes.Percent,
        },
        {
          column_name: 'Duration',
          title: 'Duration',
          uidt: UITypes.Duration,
        },
        {
          column_name: 'Rating',
          title: 'Rating',
          uidt: UITypes.Rating,
        },
        {
          column_name: 'Geometry',
          title: 'Geometry',
          uidt: UITypes.Geometry,
        },
        {
          column_name: 'JSON',
          title: 'JSON',
          uidt: UITypes.JSON,
        },
      ];

    case 'custom':
      return [{ title: 'Id', column_name: 'id', uidt: UITypes.ID }, ...options];
  }
};

const createColumn = async (
  context: Context,
  table: Model,
  columnAttr: Record<string, any>,
) => {
  const ctx = {
    workspace_id: table.fk_workspace_id,
    base_id: table.base_id,
  };

  await request(context.app)
    .post(`/api/v1/db/meta/tables/${table.id}/columns`)
    .set('xc-auth', context.token)
    .send({
      ...columnAttr,
    });

  const column: Column = (await table.getColumns(ctx)).find(
    (column) => column.title === columnAttr.title,
  );
  return column;
};

const createRollupColumn = async (
  context: Context,
  {
    base,
    title,
    rollupFunction,
    table,
    relatedTableName,
    relatedTableColumnTitle,
  }: {
    base: Base;
    title: string;
    rollupFunction: string;
    table: Model;
    relatedTableName: string;
    relatedTableColumnTitle: string;
  },
) => {
  const ctx = {
    workspace_id: base.fk_workspace_id,
    base_id: base.id,
  };

  const childBases = await base.getSources();
  const childTable = await Model.getByIdOrName(ctx, {
    base_id: base.id,
    source_id: childBases[0].id!,
    table_name: relatedTableName,
  });
  const childTableColumns = await childTable.getColumns(ctx);
  const childTableColumn = await childTableColumns.find(
    (column) => column.title === relatedTableColumnTitle,
  );

  const ltarColumn = (await table.getColumns(ctx)).find(
    (column) =>
      (column.uidt === UITypes.Links ||
        column.uidt === UITypes.LinkToAnotherRecord) &&
      column.colOptions?.fk_related_model_id === childTable.id,
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
    base,
    title,
    table,
    relatedTableName,
    relatedTableColumnTitle,
    relationColumnId,
  }: {
    base: Base;
    title: string;
    table: Model;
    relatedTableName: string;
    relatedTableColumnTitle: string;
    relationColumnId?: string;
  },
) => {
  const ctx = {
    workspace_id: base.fk_workspace_id,
    base_id: base.id,
  };

  const childBases = await base.getSources();
  const childTable = await Model.getByIdOrName(ctx, {
    base_id: base.id,
    source_id: childBases[0].id!,
    table_name: relatedTableName,
  });
  const childTableColumns = await childTable.getColumns(ctx);
  const childTableColumn = await childTableColumns.find(
    (column) => column.title === relatedTableColumnTitle,
  );

  if (!childTableColumn) {
    throw new Error(
      `Could not find column ${relatedTableColumnTitle} in ${relatedTableName}`,
    );
  }

  let ltarColumn;
  if (relationColumnId)
    ltarColumn = (await table.getColumns(ctx)).find(
      (column) => column.id === relationColumnId,
    );
  else {
    ltarColumn = (await table.getColumns(ctx)).find(
      (column) =>
        (column.uidt === UITypes.Links ||
          column.uidt === UITypes.LinkToAnotherRecord) &&
        column.colOptions?.fk_related_model_id === childTable.id,
    );
  }

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
  },
) => {
  const ctx = {
    workspace_id: table.fk_workspace_id,
    base_id: table.base_id,
  };

  const columns = await table.getColumns(ctx);
  const referencedQrValueTableColumnId = columns.find(
    (column) => column.title == referencedQrValueTableColumnTitle,
  )['id'];

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
  },
) => {
  const referencedBarcodeValueTableColumnId = await table
    .getColumns({
      workspace_id: table.fk_workspace_id,
      base_id: table.base_id,
    })
    .then(
      (cols) =>
        cols.find(
          (column) => column.title == referencedBarcodeValueTableColumnTitle,
        )['id'],
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
  },
) => {
  const ltarColumn = await createColumn(context, parentTable, {
    title: title,
    column_name: title,
    uidt: UITypes.Links,
    parentId: parentTable.id,
    childId: childTable.id,
    type: type,
  });

  return ltarColumn;
};

const updateGridViewColumn = async (
  context,
  {
    view,
    column,
    attr,
  }: {
    column: GridViewColumn;
    view: View;
    attr: any;
  },
) => {
  const ctx = {
    workspace_id: view.fk_workspace_id,
    base_id: view.base_id,
  };

  const res = await request(context.app)
    .patch(`/api/v1/db/meta/grid-columns/${column.id}`)
    .set('xc-auth', context.token)
    .expect(200)
    .send(attr);

  const updatedColumn = (await view.getColumns(ctx)).find(
    (col) => col.id === column.id,
  );

  return updatedColumn;
};

const updateViewColumn = async (
  context,
  { view, column, attr }: { column: Column; view: View; attr: any },
) => {
  const ctx = {
    workspace_id: view.fk_workspace_id,
    base_id: view.base_id,
  };

  const res = await request(context.app)
    .patch(`/api/v1/db/meta/views/${view.id}/columns/${column.id}`)
    .set('xc-auth', context.token)
    .send({
      ...attr,
    });

  const updatedColumn: FormViewColumn | GridViewColumn | GalleryViewColumn = (
    await view.getColumns(ctx)
  ).find((column) => column.id === column.id)!;

  return updatedColumn;
};

const updateColumn = async (
  context,
  { table, column, attr }: { column: Column; table: Model; attr: any },
) => {
  const ctx = {
    workspace_id: table.fk_workspace_id,
    base_id: table.base_id,
  };

  const res = await request(context.app)
    .patch(`/api/v2/meta/columns/${column.id}`)
    .set('xc-auth', context.token)
    .send({
      ...attr,
    });

  const updatedColumn: Column = (await table.getColumns(ctx)).find(
    (column) => column.id === column.id,
  );
  return updatedColumn;
};

const deleteColumn = async (
  context,
  { table, column }: { column: Column; table: Model },
) => {
  const res = await request(context.app)
    .delete(`/api/v2/meta/columns/${column.id}`)
    .set('xc-auth', context.token)
    .send({})
    .expect(200);
};

export {
  customColumns,
  defaultColumns,
  createColumn,
  createQrCodeColumn,
  createBarcodeColumn,
  createRollupColumn,
  createLookupColumn,
  createLtarColumn,
  updateGridViewColumn,
  updateViewColumn,
  updateColumn,
  deleteColumn,
};
