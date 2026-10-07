import { isCreatedOrLastModifiedTimeCol, isSystemColumn } from 'nocodb-sdk';
import type { SwaggerColumn } from '../getSwaggerColumnMetasV3';

export const getModelSchemas = (ctx: {
  tableName: string;
  schemaName: string;
  orgs: string;
  baseName: string;
  columns: Array<SwaggerColumn>;
}) => ({
  [`${ctx.schemaName}Response`]: {
    title: `${ctx.tableName} Response`,
    type: 'object',
    description: '',
    'x-internal': false,
    properties: {
      id: {
        oneOf: [{ type: 'string' }, { type: 'number' }],
        description: 'Record identifier (primary key value)',
      },
      id_fields: {
        type: 'object',
        description: 'Individual primary key field values as object',
        properties: {
          ...(ctx.columns?.reduce(
            (colsObj, { title, virtual, column, ...fieldProps }) => ({
              ...colsObj,
              ...(column.pk
                ? {
                    [title]: fieldProps,
                  }
                : {}),
            }),
            {},
          ) || {}),
        },
      },
      fields: {
        type: 'object',
        description: 'Record fields data (excluding primary key)',
        properties: {
          ...(ctx.columns?.reduce(
            (colsObj, { title, virtual, column, ...fieldProps }) => ({
              ...colsObj,
              // The API returns the system created/modified time columns.
              ...((isSystemColumn(column) &&
                !(column.system && isCreatedOrLastModifiedTimeCol(column))) ||
              column.pk
                ? {}
                : {
                    [title]: fieldProps,
                  }),
            }),
            {},
          ) || {}),
        },
      },
    },
    required: ['id'],
  },
  [`${ctx.schemaName}Request`]: {
    title: `${ctx.tableName} Request`,
    type: 'object',
    description: '',
    'x-internal': false,
    properties: {
      fields: {
        type: 'object',
        description: 'Record fields data to be created/updated',
        properties: {
          ...(ctx.columns?.reduce(
            (colsObj, { title, virtual, column, ...fieldProps }) => ({
              ...colsObj,
              ...(virtual ||
              isSystemColumn(column) ||
              column.ai ||
              column.meta?.ag
                ? {}
                : {
                    [title]: fieldProps,
                  }),
            }),
            {},
          ) || {}),
        },
      },
    },
    required: ['fields'],
  },
  [`${ctx.schemaName}UpdateRequest`]: {
    title: `${ctx.tableName} Update Request`,
    type: 'object',
    description: '',
    'x-internal': false,
    properties: {
      id: {
        oneOf: [{ type: 'string' }, { type: 'number' }],
        description:
          'Record identifier (primary key value) for the record to be updated',
      },
      fields: {
        type: 'object',
        description: 'Record fields data to be updated',
        properties: {
          ...(ctx.columns?.reduce(
            (colsObj, { title, virtual, column, ...fieldProps }) => ({
              ...colsObj,
              ...(virtual ||
              isSystemColumn(column) ||
              column.ai ||
              column.meta?.ag
                ? {}
                : {
                    [title]: fieldProps,
                  }),
            }),
            {},
          ) || {}),
        },
      },
    },
    required: ['id', 'fields'],
  },
  [`${ctx.schemaName}IdRequest`]: {
    title: `${ctx.tableName} Id Request`,
    type: 'object',
    description: '',
    'x-internal': false,
    properties: {
      id: {
        oneOf: [{ type: 'string' }, { type: 'number' }],
        description:
          'Record identifier (primary key value) for the record to be deleted',
      },
    },
    required: ['id'],
  },
});
