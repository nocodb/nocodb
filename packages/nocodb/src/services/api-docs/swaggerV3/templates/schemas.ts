import { isSystemColumn } from 'nocodb-sdk';
import type { SwaggerColumn } from '../getSwaggerColumnMetasV3';

export const getModelSchemas = (ctx: {
  tableName: string;
  orgs: string;
  baseName: string;
  columns: Array<SwaggerColumn>;
}) => ({
  [`${ctx.tableName}Response`]: {
    title: `${ctx.tableName} Response`,
    type: 'object',
    description: '',
    'x-internal': false,
    properties: {
      id: {
        oneOf: [{ type: 'string' }, { type: 'number' }],
        description: 'Record identifier (primary key value)',
      },
      fields: {
        type: 'object',
        description: 'Record fields data (excluding primary key)',
        properties: {
          ...(ctx.columns?.reduce(
            (colsObj, { title, virtual, column, ...fieldProps }) => ({
              ...colsObj,
              ...(isSystemColumn(column) || column.pk
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
  [`${ctx.tableName}Request`]: {
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
  [`${ctx.tableName}UpdateRequest`]: {
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
  [`${ctx.tableName}IdRequest`]: {
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

export const getViewSchemas = (ctx: {
  tableName: string;
  viewName: string;
  orgs: string;
  baseName: string;
  columns: Array<SwaggerColumn>;
}) => ({
  [`${ctx.tableName}${ctx.viewName}GridResponse`]: {
    title: `${ctx.tableName} : ${ctx.viewName} Response`,
    type: 'object',
    description: '',
    'x-internal': false,
    properties: {
      id: {
        oneOf: [{ type: 'string' }, { type: 'number' }],
        description: 'Record identifier (primary key value)',
      },
      fields: {
        type: 'object',
        description: 'Record fields data from view',
        properties: {
          ...(ctx.columns?.reduce(
            (colsObj, { title, virtual, column, ...fieldProps }) => ({
              ...colsObj,
              ...(isSystemColumn(column) || column.pk
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
  [`${ctx.tableName}${ctx.viewName}GridRequest`]: {
    title: `${ctx.tableName} : ${ctx.viewName} Request`,
    type: 'object',
    description: '',
    'x-internal': false,
    properties: {
      fields: {
        type: 'object',
        description: 'Record fields data for view-based operations',
        properties: {
          ...(ctx.columns?.reduce(
            (colsObj, { title, virtual, column, ...fieldProps }) => ({
              ...colsObj,
              ...(virtual
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
});
